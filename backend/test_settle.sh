#!/bin/bash
set -e
BASE="http://localhost:3000"
PASS=0
FAIL=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    green "  ✓ PASS: $desc"
    PASS=$((PASS+1))
  else
    red "  ✗ FAIL: $desc"
    red "    Expected: $expected"
    red "    Got: $actual"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo " Backend Settlement API — Runtime Verification"
echo "============================================"

# ---- Step 1: Clean start ----
echo ""
echo "--- 1. Clean start ---"
rm -f backend/data/app.db backend/data/app.db-shm backend/data/app.db-wal
kill $(lsof -ti :3000) 2>/dev/null || true
sleep 1
cd backend && node src/app.js > /tmp/server.log 2>&1 &
sleep 3
echo "Server restarted"

# ---- Step 2: Login ----
echo ""
echo "--- 2. Login ---"
# Send verify code
curl -s -X POST "$BASE/api/auth/send-verify-code" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800001111"}' > /dev/null
sleep 0.5
# Extract code from server log — format: [DEV] 验证码 → 13800001111: 396297
CODE=$(cat /tmp/server.log 2>/dev/null | grep "验证码 → 13800001111" | tail -1 | sed 's/.*: //' | grep -oE '^[0-9]{6}')
if [ -z "$CODE" ]; then
  # Fallback: read from DB
  CODE=$(node -e "const db=require('./backend/src/db').db;const r=db.prepare('SELECT code FROM verify_codes WHERE phone=?').get('13800001111');console.log(r?r.code:'')" 2>/dev/null)
fi
echo "Verification code: $CODE"
# Login with phone+code
RESP=$(curl -s -X POST "$BASE/api/auth/login-by-phone" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800001111","code":"'"$CODE"'"}')
echo "Login resp: $RESP"
TOKEN=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch(e){console.log('')}})")
echo "Token length: ${#TOKEN}"

if [ -z "$TOKEN" ]; then
  red "FAILED to get token, aborting"
  exit 1
fi

# ---- Step 3: Create company ----
echo ""
echo "--- 3. Create company ---"
RESP=$(curl -s -X POST "$BASE/api/company" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyUid":"TESTCO1","companyName":"Test Corp","companyBossTitle":"CEO","companyRole":"boss"}')
echo "Company create: $RESP"

# ---- Step 4: Create linked test items (without linkedId first, then set cross-links) ----
echo ""
echo "--- 4. Create linked test items (personal 应付 + company 垫付) ---"
RESP=$(curl -s -X POST "$BASE/api/items/linked" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"personal","mirrorScope":"company","item":{"id":1001,"category":"餐饮","type":"out","typeLabel":"应付","amount":500,"date":"2026-06-18","note":"Test 个人应付","target":"餐厅A","targetType":"vendor"},"mirrorItem":{"id":2001,"category":"餐饮","type":"out","typeLabel":"垫付","amount":500,"date":"2026-06-18","note":"Test 公司垫付","target":"餐厅A","targetType":"vendor"}}')
echo "Linked create: $RESP"
check "Linked items created" '"success":true' "$RESP"

# Set cross-links via PUT (linkedId validation requires target to exist, so do it after creation)
curl -s -X PUT "$BASE/api/items/1001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":2001}' > /dev/null
curl -s -X PUT "$BASE/api/items/2001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":1001}' > /dev/null
echo "Cross-links set: 1001↔2001"

# ---- Step 5: TEST 1 — PUT /:id/settle (personal 应付) ----
echo ""
echo "--- TEST 1: PUT /api/items/1001/settle (personal 应付结清) ---"
RESP=$(curl -s -X PUT "$BASE/api/items/1001/settle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settleInfo":"2026年06月18日 12:00"}')
echo "Settle response: $RESP"
check "Settle returns ok" '"ok":true' "$RESP"
check "Settle returns autoItems" '"autoItems"' "$RESP"

# Verify settled item
RESP=$(curl -s "$BASE/api/items?scope=personal" -H "Authorization: Bearer $TOKEN")
echo "Personal items: $RESP"
check "Item 1001 settled" '"settleStatus":"settled"' "$RESP"
check "SettleInfo has 由[应付]结清" "由.应付.结清" "$RESP"

# Verify mirror updated — check specifically for item 2001
RESP=$(curl -s "$BASE/api/items?scope=company" -H "Authorization: Bearer $TOKEN")
echo "Company items: $RESP"
# Extract item 2001 specifically
ITEM2001=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const arr=JSON.parse(d);const i=arr.find(x=>x.id===2001);console.log(JSON.stringify(i||{}))})" 2>/dev/null)
echo "Item 2001: $ITEM2001"
check "Mirror 2001 settled" '"settleStatus":"settled"' "$ITEM2001"
check "Mirror typeLabel 收入" '"typeLabel":"收入"' "$ITEM2001"

# ---- Step 6: TEST 2 — Idempotent settle ----
echo ""
echo "--- TEST 2: Idempotent settle ---"
RESP=$(curl -s -X PUT "$BASE/api/items/1001/settle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "Idempotent settle: $RESP"
check "Idempotent returns ok" '"ok":true' "$RESP"
check "Idempotent flag" '"idempotent":true' "$RESP"

# ---- Step 7: Create company scope linked items ----
echo ""
echo "--- 6. Create company linked items (company 应付 + personal 垫付) ---"
RESP=$(curl -s -X POST "$BASE/api/items/linked" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"company","mirrorScope":"personal","item":{"id":3001,"category":"采购","type":"out","typeLabel":"应付","amount":1200,"date":"2026-06-18","note":"Test 公司应付","target":"供应商B","targetType":"vendor"},"mirrorItem":{"id":4001,"category":"采购","type":"out","typeLabel":"垫付","amount":1200,"date":"2026-06-18","note":"Test 个人垫付","target":"供应商B","targetType":"vendor"}}')
echo "Company linked create: $RESP"
check "Company linked items created" '"success":true' "$RESP"

# Set cross-links
curl -s -X PUT "$BASE/api/items/3001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":4001}' > /dev/null
curl -s -X PUT "$BASE/api/items/4001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":3001}' > /dev/null
echo "Cross-links set: 3001↔4001"

# ---- Step 8: TEST 3 — PUT /:id/settle (company scope, boss) ----
echo ""
echo "--- TEST 3: PUT /api/items/3001/settle (company 应付结清, boss) ---"
RESP=$(curl -s -X PUT "$BASE/api/items/3001/settle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"settleInfo":"2026年06月18日 12:30"}')
echo "Company settle response: $RESP"
check "Company settle ok" '"ok":true' "$RESP"

RESP=$(curl -s "$BASE/api/items?scope=company" -H "Authorization: Bearer $TOKEN")
check "Company item 3001 settled" '"settleStatus":"settled"' "$RESP"

RESP=$(curl -s "$BASE/api/items?scope=personal" -H "Authorization: Bearer $TOKEN")
ITEM4001=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const arr=JSON.parse(d);const i=arr.find(x=>x.id===4001);console.log(JSON.stringify(i||{}))})" 2>/dev/null)
echo "Item 4001: $ITEM4001"
check "Personal mirror 4001 settled (boss)" '"settleStatus":"settled"' "$ITEM4001"
check "Mirror typeLabel 支出 (boss)" '"typeLabel":"支出"' "$ITEM4001"

# ---- Step 9: TEST 4 — Error: settle non-应付 (use a fresh non-应付, non-settled item) ----
echo ""
echo "--- TEST 4: Error — settle non-应付 ---"
# Create a standalone 收入 item (not 应付, not settled)
RESP=$(curl -s -X POST "$BASE/api/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"personal","item":{"id":9991,"category":"工资","type":"in","typeLabel":"收入","amount":3000,"date":"2026-06-18","note":"Test 收入","target":"公司","targetType":"internal"}}')
echo "Create收入: $RESP"
RESP=$(curl -s -X PUT "$BASE/api/items/9991/settle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "Error: $RESP"
check "Rejects non-应付" "仅结清应付项可通过此接口操作" "$RESP"

# ---- Step 10: TEST 5 — Error: non-existent item ----
echo ""
echo "--- TEST 5: Error — non-existent item ---"
RESP=$(curl -s -X PUT "$BASE/api/items/99999/settle" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "Error: $RESP"
check "404 for missing" "账单不存在" "$RESP"

# ---- Step 11: Create second user for notification test ----
echo ""
echo "--- 7. Create second user (employee) for notification test ---"
# Send verify code for second user
curl -s -X POST "$BASE/api/auth/send-verify-code" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800002222"}' > /dev/null
sleep 0.5
CODE2=$(cat /tmp/server.log 2>/dev/null | grep "验证码 → 13800002222" | tail -1 | sed 's/.*: //' | grep -oE '^[0-9]{6}')
if [ -z "$CODE2" ]; then
  CODE2=$(node -e "const db=require('./backend/src/db').db;const r=db.prepare('SELECT code FROM verify_codes WHERE phone=?').get('13800002222');console.log(r?r.code:'')" 2>/dev/null)
fi
echo "Code for employee: $CODE2"
RESP2=$(curl -s -X POST "$BASE/api/auth/login-by-phone" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800002222","code":"'"$CODE2"'"}')
TOKEN2=$(echo "$RESP2" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch(e){console.log('')}})")
echo "Employee token: ${TOKEN2:0:30}..."

# Employee joins company (POST /api/company)
RESP=$(curl -s -X POST "$BASE/api/company" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"companyUid":"TESTCO1","companyRole":"employee","companyName":"Test Corp"}')
echo "Join company: $RESP"

# Boss approves employee (POST /api/audit with list)
RESP=$(curl -s "$BASE/api/audit" -H "Authorization: Bearer $TOKEN")
echo "Audit list: $RESP"
AUDIT_ID=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const arr=JSON.parse(d);const p=arr.find(x=>x.status==='pending');console.log(p?p.id:'')})" 2>/dev/null)
if [ -n "$AUDIT_ID" ]; then
  RESP=$(curl -s -X POST "$BASE/api/audit" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '[{"id":'"$AUDIT_ID"',"status":"approved"}]')
  echo "Approve employee: $RESP"
fi

# Create company linked items from employee (without linkedId, then cross-link)
RESP=$(curl -s -X POST "$BASE/api/items/linked" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"scope":"company","mirrorScope":"personal","item":{"id":5001,"category":"交通","type":"out","typeLabel":"应付","amount":800,"date":"2026-06-18","note":"Test 员工应付","target":"Taxi","targetType":"vendor"},"mirrorItem":{"id":6001,"category":"交通","type":"out","typeLabel":"垫付","amount":800,"date":"2026-06-18","note":"Test 员工垫付","target":"Taxi","targetType":"vendor"}}')
echo "Employee linked create: $RESP"
curl -s -X PUT "$BASE/api/items/5001" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":6001}' > /dev/null
curl -s -X PUT "$BASE/api/items/6001" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"linkedId":5001}' > /dev/null
echo "Cross-links set: 5001↔6001"

# ---- Step 12: TEST 6 — Employee settles own company item (non-boss notification path) ----
echo ""
echo "--- TEST 6: Employee settles own company 应付 triggers notification ---"
# Employee settles their own company 应付 item (non-boss → notification created)
RESP=$(curl -s -X PUT "$BASE/api/items/5001/settle" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"settleInfo":"2026年06月18日 13:00"}')
echo "Employee settle own item: $RESP"

# Check notifications for employee (should include settle_pending)
RESP=$(curl -s "$BASE/api/notify" -H "Authorization: Bearer $TOKEN2")
echo "Employee notifications: $RESP"
check "Notification has type field" '"type"' "$RESP"
check "Notification has targetUserId field" '"targetUserId"' "$RESP"
check "Notification has itemId field" '"itemId"' "$RESP"
check "Notification type is settle_pending" '"settle_pending"' "$RESP"

# ---- Step 12: TEST 7 — POST /:id/settle-confirm on wrong status ----
echo ""
echo "--- TEST 7: POST /api/items/:id/settle-confirm (status guard) ---"
RESP=$(curl -s -X POST "$BASE/api/items/2001/settle-confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "settle-confirm: $RESP"
check "Rejects non-company_settled" "当前账单状态不支持确认结清操作" "$RESP"

# ---- Step 13: TEST 8 — _autoSettle DELETE protection ----
echo ""
echo "--- TEST 8: _autoSettle DELETE protection ---"
RESP=$(curl -s "$BASE/api/items?scope=personal" -H "Authorization: Bearer $TOKEN")
AUTO_ID=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const arr=JSON.parse(d);const a=arr.find(i=>i._autoSettle===true);console.log(a?a.id:'')})" 2>/dev/null)
echo "Auto-settle ID: $AUTO_ID"
if [ -n "$AUTO_ID" ]; then
  RESP=$(curl -s -X DELETE "$BASE/api/items/$AUTO_ID" \
    -H "Authorization: Bearer $TOKEN")
  echo "DELETE auto-settle: $RESP"
  check "Rejects DELETE _autoSettle" "系统自动结清记录不可手动删除" "$RESP"
else
  echo "  (no auto-settle record found)"
  FAIL=$((FAIL+1))
  red "  ✗ FAIL: Could not find _autoSettle record to test DELETE protection"
fi

# ---- Summary ----
echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed"
echo "============================================"

kill $(lsof -ti :3000) 2>/dev/null || true

[ $FAIL -eq 0 ] && exit 0 || exit 1
