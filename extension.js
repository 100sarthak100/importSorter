const vscode = require('vscode');

function activate(context) {

	const numOfMultiImports = 2;

	const importsParser = (params) => {
		let { multiImportsArray = [], singleImportsArray = [] } = params

		let multiImportsString = "";

		for (let i = 0; i < multiImportsArray?.length; i++) {
			let str = multiImportsArray?.[i] ?? "";

			/**
			 * import comp1, comp2, { a1, a2, a3, a4 } from 'library' 
			 * 
			 * import -> import
			 * whitespace -> \s*
			 * comp1, comp2, ... ,compn -> ([^}]*)
			 * whitespace -> \s*
			 * { a1, a2, a3, a4 } -> {\s*([^}]*)}
			 * whitespace -> \s*
			 * from -> from
			 * " or ' -> ["']
			 * library -> ([^"']+)
			 * " or ' -> ["']
			 */
			const libraryAndComponentsRegex = /import\s*([^}]*){\s*([^}]*)}\s*from\s*["']([^"']+)["']/;
			const match = str.match(libraryAndComponentsRegex);

			if (match) {
				const [, defaultImports, components, libraryName] = match;
				const componentList = components.split(/\s*,\s*/);

				if (componentList?.length >= numOfMultiImports) {
					let defaultImportsStr = '';
					defaultImports?.split(',')?.map((val) => {
						let s = val?.trim();
						if (s?.length) {
							defaultImportsStr += `${s},`
						}
					})

					let mainStr = `import `;
					if (defaultImportsStr?.trim()?.length) {
						mainStr += `${defaultImportsStr?.trim()} `
					}
					mainStr += `{`

					const importLines = [
						`${mainStr}`,
						...componentList?.map(component => `    ${component?.trim()},`),
						`} from "${libraryName}";`
					];

					const multilineImport = importLines.join('\n');

					multiImportsString += `${multilineImport}\n\n`;
				} else {
					singleImportsArray?.push(str);
				}
			} else {
				singleImportsArray?.push(str);
			}
		}

		return multiImportsString;
	}

	const importsSortFunc = (a, b) => {
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

	const sortFunc = () => {
		let editor = vscode.window.activeTextEditor

		let numOfLines = editor?.document?.lineCount ?? 0;

		const importRegexp = /import/gm;
		const multipleImportRegexp = /{/gm;
		const dotRegexp = /\./gm;

		let libraryImports = [];
		let componentImports = [];

		let libraryMultiImports = [];
		let componentsMultiImport = [];

		let maxImportLineNum = 0;

		/**
		 * get library & components imports array
		 */
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

		// Library Imports - parse multiImports & convert to multi line string
		let libraryMultiImportsString = importsParser({
			singleImportsArray: libraryImports,
			multiImportsArray: libraryMultiImports,
		})

		// Components Imports
		let componentMultiImortsString = importsParser({
			singleImportsArray: componentImports,
			multiImportsArray: componentsMultiImport,
		})

		// sort imports array by length
		let sortedComponentsArray = componentImports?.sort(importsSortFunc)
		let sortedLibraryArray = libraryImports?.sort(importsSortFunc)

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
