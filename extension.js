const vscode = require("vscode");

function activate(context) {
  const numOfMultiImports = 1;

  function removeExcessEmptyLines(text) {
    const regex = /\n{2,}$/;
    return text?.replace(regex, "\n") ?? "";
  }

  function countLines(text) {
    return text.split("\n")?.length;
  }

  function ensureTwoNewlinesAtEnd(text) {
    const currentNewlines = (text.match(/\n+$/) || [''])[0].length;
    const difference = currentNewlines - 2;
  
    if (difference < 0) {
      // Add newline characters to reach exactly 2
      return text + '\n'.repeat(-difference);
    } else if (difference > 0) {
      // Remove extra newline characters to reach exactly 2
      return text.slice(0, -difference);
    } else {
      // The string already has 2 newline characters at the end
      return text;
    }
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
  };

  const importsParser = (params) => {
    let { multiImportsArray = [], singleImportsArray = [] } = params;

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
      const libraryAndComponentsRegex =
        /import\s*([^}]*){\s*([^}]*)}\s*from\s*["']([^"']+)["']/;
      const match = str.match(libraryAndComponentsRegex);

      if (match) {
        const [, defaultImports, components, libraryName] = match;
        let componentList = components.split(/\s*,\s*/);

        if (!componentList?.[componentList?.length - 1]?.trim()?.length) {
          componentList?.pop();
        }

        componentList?.sort(importsSortFunc);

        if (componentList?.length >= numOfMultiImports) {
          let defaultImportsStr = "";
          defaultImports?.split(",")?.map((val) => {
            let s = val?.trim();
            if (s?.length) {
              defaultImportsStr += `${s},`;
            }
          });

          let mainStr = `import `;
          if (defaultImportsStr?.trim()?.length) {
            mainStr += `${defaultImportsStr?.trim()} `;
          }
          mainStr += `{`;

          const importLines = [
            `${mainStr}`,
            ...componentList?.map((component) => `	${component?.trim()},`),
            `} from "${libraryName}";`,
          ];

          const multilineImport = importLines.join("\n");

          multiImportsString += `${multilineImport}\n\n`;
        } else {
          singleImportsArray?.push(str);
        }
      } else {
        singleImportsArray?.push(str);
      }
    }

    let modifiedLine = removeExcessEmptyLines(multiImportsString);

    return modifiedLine;
  };

  const checkIfImportStatement = (lineText) => {
    const importRegexp = /import/gm;
    return lineText?.match(importRegexp);
  };

  const checkIfSingleLineImportStatement = (lineText) => {
    const singleLineImportRegexp = /import.*['"][^'"]+['"]/gm;
    return lineText?.match(singleLineImportRegexp);
  };

  const checkIfLineContainsLibrary = (lineText) => {
    const libraryRegexp = /from\s*('[^']*'|"[^"]*")\s*/gm;
    return lineText?.match(libraryRegexp);
  };

  const checkIfComponentImport = (lineText) => {
    const dotRegexp = /\./gm;
    return lineText?.match(dotRegexp);
  };

  const getImportNameFromLine = (lineText) => {
    const match = lineText?.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);

    if (match) {
      const libraryName = match?.[1] ?? "";
      return libraryName;
    } else {
      return "";
    }
  };

  const getCompNameFromLine = (lineText) => {
    const match = lineText?.match(/import\s+(\w+|\{[^}]*\})\s+from\s+['"]\.\.?\/*([^'"]+)['"]/);

    if (match) {
      const libraryName = match?.[1] ?? "";
      return libraryName;
    } else {
      return "";
    }
  };

  function checkLibrariesInLine(line, libraryList) {
    if (!line?.length || Object?.keys(libraryList)?.length === 0) {
      return;
    }

    let newObj = {};

    for (const obj in libraryList) {
      let libName = obj;
      let used = libraryList?.[obj] ?? false;

      if (used) {
        continue;
      }

      let case1 = `${libName}.`;

      let case2 = `${libName}?.`;

      let case3 = `${libName}(`;

      let case4 = `${libName}?.(`;

      let case5 = `${libName}`;

      let isUsed =
        line?.includes(case1) ||
        line?.includes(case2) ||
        line?.includes(case3) ||
        line?.includes(case4) ||
        line?.includes(case5)

      if (isUsed) {
        newObj = {
          ...newObj,
          [libName]: true,
        };
      }
    }

    return newObj;
  }

  function checkCompInLine(line, compList) {
    if (!line?.length || Object?.keys(compList)?.length === 0) {
      return;
    }

    let newCompObj = {};

    for (const obj in compList) {
      let compName = obj;
      let used = compList?.[obj] ?? false;

      if (used) {
        continue;
      }

      let case1 = `${compName}.`;

      let case2 = `${compName}?.`;

      let case3 = `${compName}(`;

      let case4 = `${compName}?.(`;

      let case5 = `<${compName}`;

      let case6 = `${compName}`;

      let isUsed =
        line?.includes(case1) ||
        line?.includes(case2) ||
        line?.includes(case3) ||
        line?.includes(case4) ||
        line?.includes(case5) ||
        line?.includes(case6)

      if (isUsed) {
        newCompObj = {
          ...newCompObj,
          [compName]: true,
        };
      }
    }

    return newCompObj;
  }

  const removeUnusedLibraryImports = (importList, libList) => {
    if (!importList?.length || !Object?.keys(libList)?.length) {
      return importList;
    }

    let newImportList = [...importList];

    for (let key in libList) {
      let libName = key;
      let used = libList?.[key];

      if (used) {
        continue;
      }

      for (let i = 0; i < newImportList?.length; i++) {
        let item = newImportList?.[i] ?? "";

        const match = item?.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);

        if (match) {
          const [, alias, libraryName] = match;
          if (alias === libName) {
            newImportList?.splice(i, 1);
            break;
          }
        }
      }
    }

    return newImportList;
  };

  const sortFunc = () => {
    let editor = vscode.window.activeTextEditor;

    let numOfLines = editor?.document?.lineCount ?? 0;

    let libraryImports = [];
    let componentImports = [];

    let libraryMultiImports = [];
    let componentsMultiImport = [];

    /**single line library import list
     * to remove un-used imports
     */
    let libList = {};
    let compList = {};

    let maxImportLineNum = 0;

    /**
     * get library & components imports array
     */
    let lineAtPos = 0;
    let lineText = "";

    for (let i = 0; i < numOfLines; i++) {
      lineAtPos = editor?.document?.lineAt(i);

      lineText = lineAtPos?.b ?? "";

      let importMatch = checkIfImportStatement(lineText);

      if (!importMatch) {
        if (lineText?.length && Object?.keys(libList)?.length) {
          let obj = checkLibrariesInLine(lineText, libList);

          libList = {
            ...libList,
            ...obj,
          };
        }

        if (lineText?.length && Object?.keys(compList)?.length) {
          let obj = checkCompInLine(lineText, compList);

          compList = {
            ...compList,
            ...obj
          };
        }

        continue;
      }

      maxImportLineNum = Math.max(maxImportLineNum, lineAtPos?.a);

      let singleLineMatch = checkIfSingleLineImportStatement(lineText);

      let multiLineStr = "";

      if (!singleLineMatch) {
        let libraryMatch = false;

        while (!libraryMatch) {
          multiLineStr += `${lineText?.trim()}`;
          i += 1;
          lineAtPos = editor?.document?.lineAt(i);
          lineText = lineAtPos?.b ?? "";

          maxImportLineNum = Math.max(maxImportLineNum, lineAtPos?.a);

          libraryMatch = checkIfLineContainsLibrary(lineText);

          if (libraryMatch) {
            multiLineStr += `${lineText?.trim()}`;

            const componentImportMatch = checkIfComponentImport(lineText);

            if (componentImportMatch) {
              componentsMultiImport?.push(multiLineStr);
            } else {
              libraryMultiImports?.push(multiLineStr);
            }
          }
        }
      } else {
        const componentImportMatch = checkIfComponentImport(lineText);

        if (componentImportMatch) {
          componentImports?.push(lineText);

          const importCompName = getCompNameFromLine(lineText);

          if (importCompName) {
            compList = {
              ...compList,
              [importCompName]: false,
            };
          }
        } else {
          libraryImports?.push(lineText);

          const importLibName = getImportNameFromLine(lineText);

          if (importLibName) {
            libList = {
              ...libList,
              [importLibName]: false,
            };
          }
        }
      }
    }

    // Library Imports - parse multiImports & convert to multi line string
    let libraryMultiImportsString = importsParser({
      singleImportsArray: libraryImports,
      multiImportsArray: libraryMultiImports,
    });

    // Components Imports
    let componentMultiImortsString = importsParser({
      singleImportsArray: componentImports,
      multiImportsArray: componentsMultiImport,
    });

    // sort imports array by length
    let sortedComponentsArray = componentImports?.sort(importsSortFunc);
    let sortedLibraryArray = libraryImports?.sort(importsSortFunc);

    /** Removed this feature for now */
    // let modifiedSortedLibraryArray = removeUnusedLibraryImports(
    //   sortedLibraryArray,
    //   libList
    // );

    let modifiedSortedLibraryArray = sortedLibraryArray;

    /** Removed this feature for now */
    // let modifiedSortedCompyArray = removeUnusedLibraryImports(
    //   sortedComponentsArray,
    //   compList
    // );

    let modifiedSortedCompyArray = sortedComponentsArray;

    let sortedText = ``;
    modifiedSortedLibraryArray?.map((text) => {
      sortedText += `${text}\n`;
    });

    if(sortedText?.length) {
      sortedText += `\n`;
      sortedText = ensureTwoNewlinesAtEnd(sortedText)
    }

    if (modifiedSortedCompyArray?.length) {
      modifiedSortedCompyArray?.map((text) => {
        sortedText += `${text}\n`;
      });
    }

    if (modifiedSortedCompyArray?.length) {
      sortedText += `\n`;
      sortedText = ensureTwoNewlinesAtEnd(sortedText)
    }

    if (libraryMultiImportsString) {
      sortedText += `${libraryMultiImportsString}`;
    }

    if(libraryMultiImportsString) {
      sortedText = ensureTwoNewlinesAtEnd(sortedText)
    }

    if (componentMultiImortsString) {
      sortedText += `${componentMultiImortsString}`;
    }

    sortedText = removeExcessEmptyLines(sortedText);

    let deleteRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(maxImportLineNum + 1, 0)
    );

    editor?.edit((editBuilder) => {
      editBuilder?.replace(deleteRange, sortedText);
    });

    vscode.window.showInformationMessage("imports sorted");
  };

  let disposable = vscode.commands.registerCommand(
    "importsorter.importsorter",
    sortFunc
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
