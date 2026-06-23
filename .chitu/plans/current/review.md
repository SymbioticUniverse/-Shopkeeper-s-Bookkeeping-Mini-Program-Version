# Self-Review — utils/api.js _rewriteHost + IP update

## 修改文件
- `utils/api.js`: +17 lines (2 new functions, 1 call site)

## 逐项核查

### `_apiOrigin()` (line 481-483)
- ✅ Removes `/api` or `/api/` suffix from BASE_URL
- ✅ Regex `/\/api\/?$/` correctly handles both cases
- ✅ Internal helper, not exported — no API surface change

### `_rewriteHost(url)` (line 491-493)
- ✅ Guards null/undefined URL → returns as-is
- ✅ Guards non-http URLs → returns as-is (no false rewrites on relative paths)
- ✅ Regex `^https?:\/\/[^/]+` matches scheme+host only, preserves path
- ✅ Replacement uses `_apiOrigin()` so it auto-tracks BASE_URL changes

### `downloadAuthedImage()` (line 546)
- ✅ Calls `_rewriteHost(url)` before wx.downloadFile
- ✅ Token is still read before the rewrite (correct, independent operations)
- ✅ Only call site — focused fix, no similar patterns missed

### BASE_URL (line 13)
- ✅ IP changed 192.168.1.112 → 192.168.1.111 (user's network change)

## 边界情况
- ✅ URL is null/undefined → returns as-is, wx.downloadFile will fail with clear error
- ✅ URL is relative path → regex won't match, returns as-is
- ✅ URL has port (e.g. :3000) → regex `[^/]+` includes port, correctly replaced
- ✅ URL has no port → same, correctly handled
- ✅ _apiOrigin() returns just scheme+host → replacement is clean

## 接口文档
- No new exports — `_apiOrigin` and `_rewriteHost` are internal
- Interface doc `.chitu/interfaces/utils-api.js.json` does not need updating
