# ECHIO：歌词主题

为 [ECHO](https://github.com/Moekotori/ECHO) 收集与制作歌词主题。每个主题独立维护，后续新主题会继续加入本仓库。

## 安装

1. 在下方主题目录下载 ZIP，**不用解压**。
2. 打开 ECHO → 创意工坊，把 ZIP 拖入页面，等待验证并导入。
3. 使用主题，播放歌曲并打开歌词页。

如果仍显示之前的声明式歌词场景，先把歌词布局切回 **ECHO 内置**，再使用本主题。这里的自绘歌词主题使用官方 `lyrics-view` 接口，工坊底层分类为 `Theme`。

## 主题目录

| 主题 | 风格与功能 | 下载 |
| --- | --- | --- |
| [余白 · 物语歌词](themes/monogatari/) | 四种纯色、宋体微光、弱纹理、横竖排与小字译注 | [1.0.1 ZIP](downloads/monogatari-1.0.1.zip?raw=true) |

### 余白 · 物语歌词

以下为主题实际页面在模拟宿主中的截图，使用原创演示文案，不代表 ECHO 内真实歌曲播放验收。字号指设置值，页面会随窗口宽度适配。

| 朱红 · 横排 · 36 px | 芥黄 · 竖排 · 28 px |
| --- | --- |
| ![朱红横排，36px](themes/monogatari/screenshots/red-horizontal-36.png) | ![芥黄竖排，28px](themes/monogatari/screenshots/yellow-vertical-28.png) |
| 墨黑 · 横排 · 48 px | 纸白 · 竖排 · 40 px |
| ![墨黑横排，48px](themes/monogatari/screenshots/black-horizontal-48.png) | ![纸白竖排，40px](themes/monogatari/screenshots/white-vertical-40.png) |

鼠标移到歌词页顶部中央，可切换颜色、横竖排、译文和字号；右上角暂停／继续，底部进度线定位。译文以整句小字贴近原文，横排在上方，竖排在右侧。

## 仓库结构

```text
themes/<主题名>/       每个主题的源码、工坊工程、说明和截图
downloads/            可直接导入的发行 ZIP
templates/theme/      新主题的目录约定
tools/                通用打包工具
catalog.json          主题索引
```

添加主题请看 [贡献指南](CONTRIBUTING.md)。结构参考 [Spicetify 主题合集](https://github.com/spicetify/spicetify-themes) 的独立主题目录和预览索引，以及 [ECHO 官方 SDK](https://github.com/Moekotori/echo-workshop-sdk) 的工坊项目结构；未复制其他主题的代码或素材。

## 许可

本仓库原创代码、截图和自制纹理采用 [MIT](LICENSE)。系统字体不随包分发；ECHO 本体、第三方歌词和其他素材的权利归各自权利人。后续主题若包含其他许可的素材，须在对应主题目录明确说明。
