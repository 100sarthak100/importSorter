const vscode = require('vscode');

function activate(context) {

	const sortFunc = () => {
		let editor = vscode.window.activeTextEditor
		let editorText = editor?.document.getText();

		let numOfLines = editor?.document?.lineCount ?? 0;

		const importRegexp = /import/gm;
		const multipleImportRegexp = /{/gm;

		const dotRegexp = /\./gm;

		let libraryImports = [];
		let componentImports = [];

		let libraryMultiImports = [];
		let componentsMultiImport = [];

		let maxImportLineNum = 0;

		for (let i = 0; i < numOfLines; i++) {
			let lineAtPos = editor?.document?.lineAt(i);

			let lineText = lineAtPos?.b ?? "";

			let importMatch = lineText?.match(importRegexp);

			if (importMatch) {
				maxImportLineNum = Math.max(maxImportLineNum, lineAtPos?.a);

				let dotMatch = lineText?.match(dotRegexp);

				if (dotMatch) {
					let multiImportMatch = lineText?.match(multipleImportRegexp)

					if (multiImportMatch) {
						componentsMultiImport?.push(lineText)
					} else {
						componentImports?.push(lineText);
					}
				} else {
					let multiImportMatch = lineText?.match(multipleImportRegexp)

					if (multiImportMatch) {
						libraryMultiImports?.push(lineText)
					} else {
						libraryImports?.push(lineText);
					}
				}
			}
		}

		const sortFunc = (a, b) => {
			if (a?.length > b?.length) {
				return 1;
			}

			if (a?.length === b?.length) {
				return 0;
			}

			if (a?.length < b?.length) {
				return -1;
			}
		}

		let libraryMultiImportsString = "";
		let componentMultiImortsString = "";

		// Library Imports - parse multiImports & convert to multi line string
		for (let i = 0; i < libraryMultiImports?.length; i++) {
			let str = libraryMultiImports?.[i] ?? "";

			const libraryAndComponentsRegex = /import\s*{\s*([^}]*)}\s*from\s*["']([^"']+)["']/;
			const match = str.match(libraryAndComponentsRegex);

			if (match) {
				const [, components, libraryName] = match;
				const componentList = components.split(/\s*,\s*/);

				if (componentList?.length >= 5) {
					const importLines = [
						`import {`,
						...componentList?.map(component => `    ${component},`),
						`} from "${libraryName}";`
					];

					const multilineImport = importLines.join('\n');

					libraryMultiImportsString += `${multilineImport}\n\n`;
				} else {
					libraryImports?.push(str);
				}
			} else {
				libraryImports?.push(str);
			}
		}

		// Components Imports
		for (let i = 0; i < componentsMultiImport?.length; i++) {
			let str = componentsMultiImport?.[i] ?? "";

			const libraryAndComponentsRegex = /import\s*{\s*([^}]*)}\s*from\s*["']([^"']+)["']/;
			const match = str.match(libraryAndComponentsRegex);

			if (match) {
				const [, components, libraryName] = match;
				const componentList = components.split(/\s*,\s*/);

				if (componentList?.length >= 5) {
					const importLines = [
						`import {`,
						...componentList?.map(component => `    ${component},`),
						`} from "${libraryName}";`
					];

					const multilineImport = importLines.join('\n');

					componentMultiImortsString += `${multilineImport}\n\n`;
				} else {
					libraryImports?.push(str);
				}
			} else {
				libraryImports?.push(str);
			}
		}

		// sort imports array by length
		let sortedComponentsArray = componentImports?.sort(sortFunc)

		let sortedLibraryArray = libraryImports?.sort(sortFunc)

		let sortedText = ``;
		sortedLibraryArray?.map((text) => {
			sortedText += `${text}\n`
		})

		sortedText += `\n`

		sortedComponentsArray?.map((text) => {
			sortedText += `${text}\n`
		})

		if (libraryMultiImportsString) {
			sortedText += `\n${libraryMultiImportsString}`
		}

		if (componentMultiImortsString) {
			sortedText += `${componentMultiImortsString}`
		}

		let deleteRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(maxImportLineNum + 1, 0))

		editor?.edit(editBuilder => {
			editBuilder?.replace(deleteRange, sortedText)
		})

		vscode.window.showInformationMessage('Your Imports are Sorted!');

	}

	let disposable = vscode.commands.registerCommand('importsorter.importsorter', sortFunc);

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
