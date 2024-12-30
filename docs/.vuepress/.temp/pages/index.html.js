import comp from "F:/code/markdown/project-litongjava/java-td-lib-docs/docs/.vuepress/.temp/pages/index.html.vue"
const data = JSON.parse("{\"path\":\"/\",\"title\":\"TDLib\",\"lang\":\"en-US\",\"frontmatter\":{\"home\":true,\"title\":\"TDLib\",\"heroImage\":\"/logo.png\",\"actions\":[{\"text\":\"Get Started\",\"link\":\"/get-started.html\",\"type\":\"primary\"},{\"text\":\"Documentation\",\"link\":\"/documentation\",\"type\":\"secondary\"}],\"features\":[{\"title\":\"Cross-Platform\",\"details\":\"Build Telegram clients for multiple platforms using a single, consistent codebase.\"},{\"title\":\"High Performance\",\"details\":\"Optimized for speed and efficiency, ensuring smooth and responsive user experiences.\"},{\"title\":\"Secure\",\"details\":\"Implements Telegram’s security protocols to provide end-to-end encryption and data protection.\"},{\"title\":\"Easy Integration\",\"details\":\"Simple APIs and comprehensive documentation make it easy to integrate TDLib into your projects.\"},{\"title\":\"Customizable\",\"details\":\"Highly customizable to fit the specific needs of your application, with support for various UI frameworks.\"},{\"title\":\"Active Community\",\"details\":\"Join a vibrant community of developers contributing to and supporting TDLib’s ongoing development.\"}],\"footer\":\"MIT Licensed | Copyright © 2017-present TDLib Community\"},\"headers\":[],\"git\":{},\"filePathRelative\":\"README.md\"}")
export { comp, data }

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  if (__VUE_HMR_RUNTIME__.updatePageData) {
    __VUE_HMR_RUNTIME__.updatePageData(data)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(({ data }) => {
    __VUE_HMR_RUNTIME__.updatePageData(data)
  })
}
