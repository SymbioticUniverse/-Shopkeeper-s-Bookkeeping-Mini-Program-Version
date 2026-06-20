# Review — Backend Settlement API Runtime Verification

## Summary
22/22 tests passed. All settle endpoints work correctly across all scenarios.

## Test Coverage

### Core Settle Endpoints
- ✅ `PUT /api/items/:id/settle` — personal scope (Case C)
  - 应付 → settled, 垫付镜像 → settled + typeLabel→收入
  - Auto expense + auto income records created with _autoSettle=true
- ✅ `PUT /api/items/:id/settle` — company scope, boss role (Case A/B)
  - 应付 → settled, 垫付镜像 → settled + typeLabel→支出
  - Auto expense + auto income records created
- ✅ Idempotent settle — already-settled item returns `{ok:true, idempotent:true}`
- ✅ `POST /api/items/:id/settle-confirm` — status guard rejects non-company_settled

### Error Cases
- ✅ Non-应付 item settle rejected: "仅结清应付项可通过此接口操作"
- ✅ Non-existent item settle: 404 "账单不存在"
- ✅ _autoSettle item DELETE rejected: 403 "系统自动结清记录不可手动删除"

### Notifications
- ✅ Employee settle company item → notification created with type="settle_pending"
- ✅ Notification includes targetUserId, itemId, text fields
- ✅ Notification schema migration verified (type, target_user_id, item_id columns exist)

### Known Design Notes
- `/linked` endpoint validates linkedId before insert → cross-linked items must set linked_id via PUT after creation
- Settle endpoint's ownership check (checkOwnership) prevents boss from settling employee items directly

## No Code Changes Required
All backend logic verified correct. Test script is retained at `backend/test_settle.sh` for future regression testing.
