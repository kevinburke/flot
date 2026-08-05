import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseAst } from "rollup/parseAst";

const extensions = new Set([".cjs", ".js", ".mjs"]);
const ignoredDirectories = new Set([".git", "dist", "node_modules", "worktrees"]);

function lineNumber(source, position) {
	return source.slice(0, position).split("\n").length;
}

function lineIndent(source, position) {
	const start = source.lastIndexOf("\n", position - 1) + 1;
	return source.slice(start, position).match(/^[\t ]*/)?.[0] ?? "";
}

function lineStart(source, position) {
	return source.lastIndexOf("\n", position - 1) + 1;
}

function fileIndentUnit(source) {
	const widths = [...source.matchAll(/^( +)\S/gm)]
		.map((match) => match[1].length)
		.filter((width) => width % 2 === 0);
	const tabLines = [...source.matchAll(/^\t+\S/gm)].length;
	if (tabLines > widths.length) {
		return "\t";
	}
	const fourSpaceLines = widths.filter((width) => width % 4 === 0).length;
	return widths.length > 0 && fourSpaceLines / widths.length < 0.8 ? "  " : "    ";
}

function controlFlowBodies(node) {
	if (node.type === "IfStatement") {
		const bodies = [node.consequent];
		if (node.alternate && node.alternate.type !== "IfStatement") {
			bodies.push(node.alternate);
		}
		return bodies;
	}
	if (
		node.type === "ForStatement" ||
		node.type === "ForInStatement" ||
		node.type === "ForOfStatement" ||
		node.type === "WhileStatement" ||
		node.type === "DoWhileStatement"
	) {
		return [node.body];
	}
	return [];
}

function formatControlFlowPass(source) {
	const sourceFile = parseAst(source, { allowReturnOutsideFunction: true });
	const edits = [];
	const issues = [];
	const fileUnit = fileIndentUnit(source);

	function checkBlock(block, parent) {
		if (block.type !== "BlockStatement") {
			return;
		}

		const open = block.start;
		const close = block.end - 1;
		const baseIndent = lineIndent(source, parent.start);
		const unit = baseIndent.includes("\t") ? "\t" : fileUnit;
		if (block.body.length === 0) {
			if (lineNumber(source, open) === lineNumber(source, close)) {
				issues.push(lineNumber(source, open));
				edits.push({ start: open + 1, end: close, text: `\n${baseIndent}` });
			}
			return;
		}

		const first = block.body[0].start;
		const last = block.body[block.body.length - 1].end;
		if (lineNumber(source, open) === lineNumber(source, first)) {
			issues.push(lineNumber(source, open));
			const gap = source.slice(open + 1, first);
			edits.push({
				start: open + 1,
				end: /^\s*$/.test(gap) ? first : open + 1,
				text: `\n${baseIndent}${unit}`,
			});
		} else {
			const start = lineStart(source, first);
			const currentIndent = source.slice(start, first);
			const expectedIndent = `${baseIndent}${unit}`;
			if (/^[\t ]*$/.test(currentIndent) && currentIndent !== expectedIndent) {
				issues.push(lineNumber(source, first));
				edits.push({ start, end: first, text: expectedIndent });
			}
		}
		if (lineNumber(source, last) === lineNumber(source, close)) {
			issues.push(lineNumber(source, close));
			const gap = source.slice(last, close);
			edits.push({
				start: /^\s*$/.test(gap) ? last : close,
				end: close,
				text: `\n${baseIndent}`,
			});
		} else {
			const start = lineStart(source, close);
			const currentIndent = source.slice(start, close);
			if (/^[\t ]*$/.test(currentIndent) && currentIndent !== baseIndent) {
				issues.push(lineNumber(source, close));
				edits.push({ start, end: close, text: baseIndent });
			}
		}
	}

	function visit(node) {
		if (node.type === "IfStatement" && node.alternate) {
			const gap = source.slice(node.consequent.end, node.alternate.start);
			const elseIndex = gap.lastIndexOf("else");
			const beforeElse = elseIndex === -1 ? "" : gap.slice(0, elseIndex);
			const commentLines = beforeElse
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean);
			const hasOnlyLineComments =
				commentLines.length > 0 && commentLines.every((line) => line.startsWith("//"));
			if (/^\s*else\s*$/.test(gap) && gap !== " else ") {
				issues.push(lineNumber(source, node.alternate.start));
				edits.push({
					start: node.consequent.end,
					end: node.alternate.start,
					text: " else ",
				});
			} else if (
				hasOnlyLineComments &&
				/^else\s*$/.test(gap.slice(elseIndex)) &&
				node.alternate.type === "BlockStatement" &&
				node.alternate.body.length > 0 &&
				lineNumber(source, node.alternate.start) !==
					lineNumber(source, node.alternate.body[0].start)
			) {
				issues.push(lineNumber(source, node.alternate.start));
				edits.push({
					start: node.consequent.end,
					end: node.alternate.start,
					text: " else ",
				});
				const baseIndent = lineIndent(source, node.start);
				const unit = baseIndent.includes("\t") ? "\t" : fileUnit;
				const indent = `${baseIndent}${unit}`;
				edits.push({
					start: node.alternate.start + 1,
					end: node.alternate.start + 1,
					text: `\n${indent}${commentLines.join(`\n${indent}`)}`,
				});
			}
		}
		for (const body of controlFlowBodies(node)) {
			checkBlock(body, node);
		}
		for (const value of Object.values(node)) {
			if (Array.isArray(value)) {
				for (const child of value) {
					if (child && typeof child.type === "string") {
						visit(child);
					}
				}
			} else if (value && typeof value === "object" && typeof value.type === "string") {
				visit(value);
			}
		}
	}
	visit(sourceFile);

	let formatted = source;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		formatted = formatted.slice(0, edit.start) + edit.text + formatted.slice(edit.end);
	}
	return { formatted, lines: [...new Set(issues)].sort((a, b) => a - b) };
}

export function formatControlFlow(source) {
	let formatted = source;
	const lines = new Set();
	while (true) {
		const result = formatControlFlowPass(formatted);
		for (const line of result.lines) {
			lines.add(line);
		}
		if (result.formatted === formatted) {
			return { formatted, lines: [...lines].sort((a, b) => a - b) };
		}
		formatted = result.formatted;
	}
}

async function sourceFiles(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (ignoredDirectories.has(entry.name)) {
				continue;
			}
			if (directory === "examples" && entry.name === "shared") {
				continue;
			}
			files.push(...(await sourceFiles(path.join(directory, entry.name))));
		} else if (extensions.has(path.extname(entry.name))) {
			files.push(path.join(directory, entry.name));
		}
	}
	return files;
}

async function main() {
	const write = process.argv.slice(2).includes("--write");
	let failed = false;
	for (const fileName of await sourceFiles(".")) {
		const source = await readFile(fileName, "utf8");
		const result = formatControlFlow(source);
		if (result.formatted === source) {
			continue;
		}
		if (write) {
			await writeFile(fileName, result.formatted);
			continue;
		}
		failed = true;
		for (const line of result.lines) {
			console.error(`${fileName}:${line}: control-flow block must span multiple lines`);
		}
	}
	if (failed) {
		process.exitCode = 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
