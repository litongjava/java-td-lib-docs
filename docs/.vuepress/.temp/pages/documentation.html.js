import comp from "F:/code/markdown/project-litongjava/java-td-lib-docs/docs/.vuepress/.temp/pages/documentation.html.vue"
const data = JSON.parse("{\"path\":\"/documentation.html\",\"title\":\"Document\",\"lang\":\"en-US\",\"frontmatter\":{},\"headers\":[{\"level\":2,\"title\":\"Api Document\",\"slug\":\"api-document\",\"link\":\"#api-document\",\"children\":[]}],\"git\":{},\"filePathRelative\":\"documentation.md\"}")
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
