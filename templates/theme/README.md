# 新主题目录模板

将以下结构建立在 `themes/<theme-slug>/`：

```text
README.md                    介绍、安装、操作、兼容性、素材许可
echo.workshop.project.json    工坊作者工程
preview.png                  工坊封面
content/
  echo.workshop.json          独立 ID、版本、入口、许可、文件清单
  theme.json                 lyrics-view 运行时声明
  ui/                        HTML / CSS / JavaScript / 本地素材
screenshots/                 实际页面截图
```

从 ECHO 官方 SDK 的 `lyrics-view-runtime` 示例起步，或参考仓库中已有主题。此目录只是约定，不是可导入的主题。新主题加入 catalog.json 后会与已有主题并列维护。
