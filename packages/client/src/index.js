import { createElement as h } from 'react'
import { ReaderPanel, ReaderTitle } from './panel.js'

export const name = 'weread-reader-client'
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

const TAB_ID = 'weread-reader'
const TAB_KIND = 'weread-reader'
const NS = 'weread.reader'

const zh = {
  title: '微信读书',
  guideDescription: '扫码登录微信读书，在右侧栏阅读并可一键复制单章或多章，方便交给 AI 分析。',
  open: '微信读书',
}

const en = {
  title: 'Weread Reader',
  guideDescription: 'Scan to log in to WeChat Reading, read in the right sidebar, and copy one or more chapters for AI analysis.',
  open: 'Weread',
}

function BookIcon(props = {}) {
  const size = props.size || 36
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true },
    h('rect', { x: 8, y: 7, width: 20, height: 22, rx: 2, stroke: 'currentColor', strokeWidth: 2 }),
    h('path', { d: 'M13 14h10M13 19h10M13 24h6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
  )
}

function TabBody(props) {
  return h(ReaderPanel, props)
}

function TabTitle() {
  return h(ReaderTitle)
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS)

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => t('title'),
    guide: [{
      id: 'weread-reader',
      order: 34,
      title: () => t('title'),
      description: () => t('guideDescription'),
      icon: BookIcon,
    }],
  }))

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    locale: NS,
  }, TabBody)))

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: TAB_ID,
    locale: NS,
  }, TabTitle)))
}
