import * as fs from "node:fs";
import * as path from "node:path";
import ignore from "ignore";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

function generateMarkdownFromDirectory(directoryPath: string): string {
	// Read .gitignore file
	let gitignore = "";
	const gitignorePath = path.join(directoryPath, ".gitignore");
	if (fs.existsSync(gitignorePath)) {
		gitignore = fs.readFileSync(gitignorePath, "utf8");
	}

	gitignore += `
.git
test
.yarn
.idea
.gitignore
*.md
*.json
*.html
vite.config.js
yarn.lock`;

	// Create ignore instance
	const ig = ignore().add(gitignore);

	// Generate markdown content
	let markdownContent = "";

	function traverseDirectory(currentPath: string, relativePath = "") {
		const entries = fs.readdirSync(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			const relPath = path.join(relativePath, entry.name);

			if (ig.ignores(relPath)) continue;

			if (entry.isDirectory()) {
				traverseDirectory(fullPath, relPath);
			} else if (entry.isFile()) {
				const fileContent = fs.readFileSync(fullPath, "utf8");
				const fileExtension = path.extname(fullPath).slice(1);

				markdownContent += `${relPath}:\n\`\`\`${fileExtension}\n${fileContent}\n\`\`\`\n\n`;
			}
		}
	}

	traverseDirectory(directoryPath);

	return markdownContent.trim();
}

// Parse command line arguments
const argv = await yargs(hideBin(process.argv))
	.usage("Usage: $0 -d <directory>")
	.option("directory", {
		alias: "d",
		describe: "Path to the directory to process",
		type: "string",
		demandOption: true,
	})
	.option("output", {
		alias: "o",
		describe: "Path to the output file",
		type: "string",
	})
	.help("h")
	.alias("h", "help")
	.example("$0 -d ./my-project", "Generate markdown for ./my-project directory")
	.epilog("For more information, check out the README.md").argv;

// Main execution
const directoryPath = argv.directory as string;

if (!fs.existsSync(directoryPath)) {
	console.error(`Error: Directory "${directoryPath}" does not exist.`);
	process.exit(1);
}

if (!fs.statSync(directoryPath).isDirectory()) {
	console.error(`Error: "${directoryPath}" is not a directory.`);
	process.exit(1);
}

const markdown = generateMarkdownFromDirectory(directoryPath);

if (argv.output) {
	fs.writeFileSync(argv.output, markdown);
	console.log(`Markdown content written to ${argv.output}`);
} else {
	console.log(markdown);
}
