import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  lang: 'en-US',

  title: 'Java Tdlib',
  description: 'Telegram Database Library',

  theme: defaultTheme({
    logo: '/logo.png',

    navbar: ['/', '/get-started'],
  }),

  bundler: viteBundler(),
})
