
import * as vscode from 'vscode'
import { Commands, Config,  CurrentFile } from '../core'
import { ExtensionModule } from '../modules'


let isActive = false
let provider: vscode.Disposable

const enable = function() {
  provider = vscode.languages.registerCompletionItemProvider(['typescript', 'vue', 'javascript'], {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

      const loader = CurrentFile.loader
      const locale = Config.sourceLanguage
      console.log('map((key))', loader.keys)
      return loader.keys.map((key) => {
        const snippetCompletion = new vscode.CompletionItem(loader.getValueByKey(key, locale, 0)|| "")
        console.log(snippetCompletion)
        console.log('insertText', snippetCompletion.insertText)
        console.log('documentation', snippetCompletion.documentation)
        snippetCompletion.insertText = new vscode.SnippetString(`\${1|this.$t,$t,i18n.t|}('${key}')`)
        snippetCompletion.documentation = new vscode.MarkdownString(`*i18n Key* \n\n${key}\n\n${loader.getValueByKey(key, Config.sourceLanguage, 0)|| ""}`)
        return snippetCompletion
      })
    },
  })
}

const m: ExtensionModule = () => {
  return vscode.commands.registerCommand(Commands.auto_completion, () => {
    if (isActive)
      provider.dispose()
    else
      enable()

    isActive = !isActive
    vscode.window.showInformationMessage(isActive ? 'i18n intellisense activated' : 'i18n intellisense deactivated')
  })
}

export default m
