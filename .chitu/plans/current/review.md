# Self-Review — utils/api.js 接口文档导出项清理

## 修改文件
- `.chitu/interfaces/utils-api.js.json`: 修复 2 个导出项中的注释文本泄露

## 逐项核查

### utils-api.js.json
- ✅ `"// 凭证上传\n  uploadVoucher"` → `"uploadVoucher"` — 清理注释前缀
- ✅ `"// 新增：云端同步\n  syncFromCloud"` → `"syncFromCloud"` — 清理注释前缀
- ✅ 导出列表与源码 `module.exports` 37 个符号全部对应（含 settleItem/settleConfirm/refreshItems/joinCompany/uploadVoucher/downloadAuthedImage/syncFromCloud 7 个计划外但已实现的导出）
- ✅ `"api"` 保留（作为模块自身的元导出标记，非源码 module.exports 键）

## 边界情况
- ✅ 导出列表已无换行符或注释混杂，machine-parseable
