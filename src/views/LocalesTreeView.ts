import * as clipboardy from 'clipboardy'
import { Common, LocaleLoader, LocaleNode, LocaleRecord, LocaleTree } from '../core'
import { ExtensionModule } from '../modules'
import { TreeItem, ExtensionContext, TreeItemCollapsibleState, TreeDataProvider, EventEmitter, Event, window, commands } from 'vscode'

export type Node = LocaleNode | LocaleRecord | LocaleTree

export class Item extends TreeItem {
  constructor (
    private ctx: ExtensionContext,
    public readonly node: Node,
    public flatten = false
  ) {
    super('')
  }

  get tooltip (): string {
    return `${this.node.keypath}`
  }

  get label (): string {
    if (this.node.type === 'record') {
      return this.node.locale
    }
    else {
      return this.flatten
        ? this.node.keypath
        : this.node.keyname
    }
  }

  set label (_) {}

  get collapsibleState () {
    if (this.node.type === 'record')
      return TreeItemCollapsibleState.None
    else
      return TreeItemCollapsibleState.Collapsed
  }

  set collapsibleState (_) {}

  get description (): string {
    if (this.node.type === 'node')
      return this.node.value
    if (this.node.type === 'record')
      return this.node.value || '(empty)'
    return ''
  }

  get iconPath () {
    if (this.node.type === 'tree')
      return this.ctx.asAbsolutePath('static/icon-module.svg')
    else if (this.node.type === 'node')
      return this.ctx.asAbsolutePath('static/icon-string.svg')
    return undefined
  }

  get contextValue () {
    let isSource = false
    if (this.node.type === 'record')
      isSource = this.node.locale === Common.sourceLanguage
    return this.node.type + (isSource ? '-source' : '')
  }
}

export class LocalesTreeProvider implements TreeDataProvider<Item> {
  private loader: LocaleLoader
  private _flatten: boolean
  private _onDidChangeTreeData: EventEmitter<Item | undefined> = new EventEmitter<Item | undefined>();
  readonly onDidChangeTreeData: Event<Item | undefined> = this._onDidChangeTreeData.event;

  constructor (
    private ctx: ExtensionContext,
    public includePaths?: string[],
    flatten = false,
  ) {
    this._flatten = flatten
    this.loader = Common.loader
    this.loader.addEventListener('changed', () => this.refresh())
  }

  protected refresh (): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem (element: Item): TreeItem {
    return element
  }

  newItem (node: Node) {
    return new Item(this.ctx, node, this.flatten)
  }

  get flatten () {
    return this._flatten
  }

  set flatten (value) {
    if (this._flatten !== value) {
      this._flatten = value
      this.refresh()
    }
  }

  private filter (node: Node): boolean {
    if (!this.includePaths)
      return true

    for (const includePath of this.includePaths) {
      if (includePath.startsWith(node.keypath))
        return true
    }
    return false
  }

  private getRoots () {
    const nodes = this.flatten
      ? Object.values(this.loader.flattenLocaleTree)
      : Object.values(this.loader.localeTree.children)

    return nodes
      .filter(node => this.filter(node))
      .map(node => this.newItem(node))
  }

  async getChildren (element?: Item) {
    if (!element)
      return this.getRoots()

    let nodes: Node[] = []

    if (element.node.type === 'tree')
      nodes = Object.values(element.node.children)

    else if (element.node.type === 'node')
      nodes = Object.values(this.loader.getShadowLocales(element.node))

    return nodes
      .filter(node => this.filter(node))
      .map(r => this.newItem(r))
  }
}

export class LocalesTreeView {
  constructor (ctx: ExtensionContext) {
    const treeDataProvider = new LocalesTreeProvider(ctx)
    window.createTreeView('locales-tree', { treeDataProvider })
  }
}

const m: ExtensionModule = (ctx) => {
  const provider = new LocalesTreeProvider(ctx)

  return [
    window.registerTreeDataProvider('locales-tree', provider),

    commands.registerCommand('extension.vue-i18n-ally.copy-key', ({ node }: {node: LocaleNode}) => {
      clipboardy.writeSync(`$t('${node.keypath}')`)
      window.showInformationMessage('I18n key copied')
    }),

    commands.registerCommand('extension.vue-i18n-ally.translate-key', async ({ node }: {node: LocaleRecord}) => {
      try {
        const pending = await Common.loader.MachineTranslateRecord(node)
        if (pending) {
          await Common.loader.writeToFile(pending)
          window.showInformationMessage('Translation saved!')
        }
      }
      catch (err) {
        window.showErrorMessage(err.toString())
      }
    }),

    commands.registerCommand('extension.vue-i18n-ally.edit-key', async ({ node }: {node: LocaleRecord}) => {
      try {
        const newvalue = await window.showInputBox({
          value: node.value,
          prompt: `Edit key "${node.keypath}" on ${node.locale}`,
        })

        if (newvalue !== undefined && newvalue !== node.value) {
          await Common.loader.writeToFile({
            value: newvalue,
            keypath: node.keypath,
            filepath: node.filepath,
            locale: node.locale,
          })
        }
      }
      catch (err) {
        window.showErrorMessage(err.toString())
      }
    }),
  ]
}

export default m
