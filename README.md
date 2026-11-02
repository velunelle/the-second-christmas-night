# 第二个圣诞夜

Three.js 交互式 3D 圣诞城市漫游，署名 Velunelle。支持自由行走、电影漫游、雪夜与雨夜切换、室内探索、背景音乐和文案编辑。

## 两个版本均完整保留

| 版本 | 网站入口 | 原始源码提交 |
| --- | --- | --- |
| 上一版，保留车辆与较密集的建筑 | [进入上一版](versions/previous/dist/index.html) | `c03ca68003918ec103e5e47374b4cc1e7801a3a1` |
| 当前版，圆润字体、剪影行人、删减车辆与部分高楼 | [进入当前版](versions/current/dist/index.html) | `e4f73548f1ab1c36a26a9d4e54f0edde24c6bf47` |

每个版本目录均包含完整网站源码、模型、纹理、字体、依赖和原有文档。`versions/manifest.json` 记录来源提交、文件大小和 SHA-256 校验值。为保存历史，版本内部仍保留导出时的《第十二个圣诞夜》字样。

后续新版本应另建目录；未经作者确认，不覆盖或删除已有版本。

## 本地运行

下载本仓库 ZIP 并解压，在仓库根目录运行：

```sh
python3 -m http.server 5179
```

浏览器打开 `http://localhost:5179/`，通过版本选择页进入。需要支持 WebGL 2 的浏览器，手机建议横屏。请通过 HTTP 服务打开，多文件项目不能直接双击 HTML 运行。

当前在线站点：https://snowfall-nocturne-velunelle.fuzzy-egret-1442.chatgpt.site/ （当前版）。仓库根目录的 `index.html` 提供两个版本的选择入口，可用于静态托管。

## 署名与许可

圣诞主题改编与作品署名：Velunelle。基础夜城来自 Hyraland/night-rain-city-skill；开场参考 knacl47/between-us；松树来自 dgreenheck/ez-tree；烟花来自 toddegray/fireworks。第三方素材分别遵循原许可，请保留各版本中的鸣谢、许可证与来源文件；本仓库不另行替代第三方许可。

本次仅归档和增加版本选择页，未修改两个历史版本的画面与逻辑。上传校验验证文件完整性，不代表已经重新验证手机帧率。
