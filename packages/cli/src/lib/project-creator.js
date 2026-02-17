/**
 * @typedef {import('type-fest').PackageJson & {scripts?: Record<string, string>;}} Package
 * @typedef PackageManager @type {'npm' | 'yarn' | 'pnpm' | 'bun'}
 */

import { join, basename } from 'node:path';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { green, dim } from 'kleur/colors';
import ora from 'ora';

import { downloadTemplate, getLocalTemplatePath, isLocalDevelopment } from './templates.js';

/**
 * Create a new Ripple project
 * @param {object} options - Project creation options
 * @param {string} options.projectName - Name of the project
 * @param {string} options.projectPath - Absolute path where project will be created
 * @param {string} options.templateName - Template to use
 * @param {PackageManager} options.packageManager - Package manager to use
 * @param {boolean} options.gitInit - Whether to initialize Git
 * @param {string} [options.stylingFramework] - Styling framework to use
 * @param {boolean} [options.ssr] - Whether to scaffold SSR server wiring
 * @param {string} [options.adapter] - SSR adapter to use (default: node)
 */
export async function createProject({
	projectName,
	projectPath,
	templateName,
	packageManager = 'npm',
	gitInit = false,
	stylingFramework = 'vanilla',
	ssr = false,
	adapter = 'node',
}) {
	console.log(dim(`Creating project: ${projectName}`));
	console.log(dim(`Template: ${templateName}`));
	console.log(dim(`Package manager: ${packageManager}`));
	console.log();

	/** @type {string} */
	let templatePath;
	let isTemporary = false;

	// Step 1: Get or download template
	const spinner1 = ora('Preparing template...').start();
	try {
		if (isLocalDevelopment()) {
			// Use local template for development
			templatePath = getLocalTemplatePath(templateName);
			if (!existsSync(templatePath)) {
				throw new Error(`Local template "${templateName}" not found at ${templatePath}`);
			}
			spinner1.succeed('Local template located');
		} else {
			// Download template from GitHub
			spinner1.text = 'Downloading template from GitHub...';
			templatePath = await downloadTemplate(templateName);
			isTemporary = true;
			spinner1.succeed('Template downloaded');
		}
	} catch (error) {
		spinner1.fail('Failed to prepare template');
		throw error;
	}

	// Step 2: Create project directory
	const spinner2 = ora('Creating project directory...').start();
	try {
		mkdirSync(projectPath, { recursive: true });
		spinner2.succeed('Project directory created');
	} catch (error) {
		spinner2.fail('Failed to create project directory');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 3: Copy template files
	const spinner3 = ora('Copying template files...').start();
	try {
		cpSync(templatePath, projectPath, {
			recursive: true,
			filter: (src) => {
				// Skip node_modules and any lock files from template
				const relativePath = src.replace(templatePath, '');
				return (
					!relativePath.includes('node_modules') &&
					!relativePath.includes('package-lock.json') &&
					!relativePath.includes('yarn.lock') &&
					!relativePath.includes('pnpm-lock.yaml') &&
					!relativePath.includes('bun.lock')
				);
			},
		});
		spinner3.succeed('Template files copied');
	} catch (error) {
		spinner3.fail('Failed to copy template files');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 4: Scaffold SSR wiring (optional)
	if (ssr) {
		const spinner4 = ora('Scaffolding SSR server wiring...').start();
		try {
			scaffoldSSR(projectPath, adapter);
			spinner4.succeed('SSR wiring created');
		} catch (error) {
			spinner4.fail('Failed to scaffold SSR wiring');
			if (isTemporary) {
				rmSync(templatePath, { recursive: true, force: true });
			}
			throw error;
		}
	}

	// Step 5: Update package.json
	const spinner5 = ora('Configuring package.json...').start();
	try {
		updatePackageJson(projectPath, projectName, packageManager, stylingFramework, {
			ssr,
			adapter,
		});
		spinner5.succeed('Package.json configured');
	} catch (error) {
		spinner5.fail('Failed to configure package.json');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 6: Configure styling
	const spinner6 = ora('Configuring styling framework...').start();
	try {
		configureStyling(projectPath, stylingFramework);
		spinner6.succeed('Styling framework configured');
	} catch (error) {
		spinner6.fail('Failed to configure styling framework');
		if (isTemporary) {
			rmSync(templatePath, { recursive: true, force: true });
		}
		throw error;
	}

	// Step 7: Initialize Git (if requested)
	if (gitInit) {
		const spinner7 = ora('Initializing Git repository...').start();
		try {
			execSync('git init', { cwd: projectPath, stdio: 'ignore' });
			spinner7.succeed('Git repository initialized');
		} catch (error) {
			spinner7.warn('Git initialization failed (optional)');
		}
	}

	// Clean up temporary template directory
	if (isTemporary) {
		try {
			rmSync(templatePath, { recursive: true, force: true });
		} catch (error) {
			// Ignore cleanup errors
		}
	}

	console.log();
	console.log(green('✓ Project created successfully!'));
}

/**
 * @param {string} projectPath
 * @param {string} adapter
 * @returns {void}
 */
function scaffoldSSR(projectPath, adapter) {
	if (adapter !== 'node') {
		throw new Error(`Unsupported SSR adapter: ${adapter}`);
	}

	const configPath = join(projectPath, 'ripple.config.js');
	const routesPath = join(projectPath, 'src', 'routes.js');
	const middlewarePath = join(projectPath, 'src', 'middleware.js');
	const serverPath = join(projectPath, 'src', 'server.js');

	const configSource = `import { defineConfig } from '@ripple-ts/meta';
import { routes } from './src/routes.js';
import { loggingMiddleware } from './src/middleware.js';
import { serve } from '@ripple-ts/adapter-node';

export default defineConfig({
\tmode: 'hybrid',
\tport: 3000,
\tadapter: { serve },
\troutes,
\tapp: {
\t\tmiddlewares: [loggingMiddleware],
\t},
});
`;

	const routesSource = `import { RenderRoute } from '@ripple-ts/meta/routing';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

export const routes = [new RenderRoute({ path: '/', entry: App })];
`;

	const middlewareSource = `export async function loggingMiddleware(context, next) {
\tconst response = await next();
\treturn response;
}
`;

	const serverSource = `import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import config from '../ripple.config.js';
import { createApp, createProdHandler } from '@ripple-ts/meta';

const app = createApp({
\troutes: config.routes,
\tmode: config.mode,
});

for (const middleware of config.app?.middlewares ?? []) {
\tapp.use(middleware);
}

let active_fetch = app.fetch;
let active_middleware = null;

if (process.env.NODE_ENV !== 'production') {
\tconst { createDevHandler } = await import('@ripple-ts/meta/dev');
\tconst dev = await createDevHandler(app, { root: process.cwd(), template: 'index.html' });
\tactive_fetch = dev.fetch;
\tactive_middleware = dev.middleware;
} else {
\tconst template = await readFile(new URL('../client/index.html', import.meta.url), 'utf-8');
\tactive_fetch = createProdHandler(app, { template }).fetch;
}

export function fetch(request, platform) {
\treturn active_fetch(request, platform);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
\tconst server = config.adapter.serve(fetch, { port: config.port, middleware: active_middleware });
\tserver.listen();
}
`;

	writeFileSync(configPath, configSource);
	writeFileSync(routesPath, routesSource);
	writeFileSync(middlewarePath, middlewareSource);
	writeFileSync(serverPath, serverSource);
}

/**
 * Update package.json with project-specific configurations
 * @param {string} projectPath - Path to the project
 * @param {string} projectName - Name of the project
 * @param {PackageManager} packageManager - Package manager being used
 * @param {string} stylingFramework - Styling framework being used
 * @param {{ ssr: boolean, adapter: string }} options - Additional options
 */
function updatePackageJson(projectPath, projectName, packageManager, stylingFramework, options) {
	const { ssr, adapter } = options;
	const packageJsonPath = join(projectPath, 'package.json');

	if (!existsSync(packageJsonPath)) {
		throw new Error('package.json not found in template');
	}

	/** @type {Package} */
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

	// Update package name
	packageJson.name = basename(projectName);

	// Remove version if it exists (since this is a new project)
	if (packageJson.version === '0.0.0') {
		packageJson.version = '1.0.0';
	}

	// Update description
	packageJson.description = `A Ripple application created with create-ripple`;

	// Add package manager field if not npm
	if (packageManager !== 'npm') {
		packageJson.packageManager = getPackageManagerVersion(packageManager);
	}

	// Add styling dependencies
	if (stylingFramework === 'tailwind') {
		packageJson.devDependencies = {
			...packageJson.devDependencies,
			tailwindcss: '^4.1.12',
			'@tailwindcss/vite': '^4.1.12',
		};
	} else if (stylingFramework === 'bootstrap') {
		packageJson.dependencies = {
			...packageJson.dependencies,
			bootstrap: '^5.3.0',
		};
	}

	if (ssr) {
		if (adapter !== 'node') {
			throw new Error(`Unsupported SSR adapter: ${adapter}`);
		}

		packageJson.dependencies = {
			...packageJson.dependencies,
			'@ripple-ts/meta': 'latest',
			'@ripple-ts/adapter-node': 'latest',
		};

		packageJson.scripts = {
			...packageJson.scripts,
			'dev:ssr': 'node src/server.js',
			'build:client': 'vite build --outDir dist/client',
			'build:server': 'vite build --ssr src/server.js --outDir dist/server',
			build:
				'vite build --outDir dist/client && vite build --ssr src/server.js --outDir dist/server',
			'serve:ssr': 'node dist/server/server.js',
		};
	}

	// Ensure we're using the latest versions
	updateDependencyVersions(packageJson);

	// Update scripts based on package manager
	updateScripts(packageJson);

	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
}

/** Configure styling framework in the project
 * @param {string} projectPath - Path to the project
 * @param {string} stylingFramework - Styling framework to use
 */
function configureStyling(projectPath, stylingFramework) {
	if (stylingFramework === 'tailwind') {
		const tailwindConfig = `import type { Config } from 'tailwindcss';
export default {
	content: [
		"./index.html",
		"./src/**/*.{ts,ripple}",
	],
	theme: {
		extend: {},
	},
	plugins: []
} satisfies Config
`;
		writeFileSync(join(projectPath, 'tailwind.config.ts'), tailwindConfig);
		const mainCss = `@import "tailwindcss";
@config "../tailwind.config.ts";`;
		writeFileSync(join(projectPath, 'src', 'index.css'), mainCss);

		const mainTs = readFileSync(join(projectPath, 'src', 'index.ts'), 'utf-8');
		const newMainTs = "import './index.css';\n" + mainTs;
		writeFileSync(join(projectPath, 'src', 'index.ts'), newMainTs);

		if (existsSync(join(projectPath, 'vite.config.js'))) {
			rmSync(join(projectPath, 'vite.config.js'));
		}
		const viteConfig = `import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [ripple(), tailwindcss()],
	server: {
		port: 3000
	}
});
`;
		writeFileSync(join(projectPath, 'vite.config.js'), viteConfig);
	} else if (stylingFramework === 'bootstrap') {
		const mainTs = readFileSync(join(projectPath, 'src', 'index.ts'), 'utf-8');
		const newMainTs = "import 'bootstrap/dist/css/bootstrap.min.css';\n" + mainTs;
		writeFileSync(join(projectPath, 'src', 'index.ts'), newMainTs);
	}
}

/**
 * Update dependency versions to latest
 * @param {Package} packageJson - Package.json object
 */
function updateDependencyVersions(packageJson) {
	// Use the latest versions for Ripple packages
	const latestVersions = {
		ripple: 'latest',
		'@ripple-ts/meta': 'latest',
		'@ripple-ts/adapter-node': 'latest',
		'@ripple-ts/vite-plugin': 'latest',
		'@ripple-ts/prettier-plugin': 'latest',
		'@ripple-ts/eslint-plugin': 'latest',
		'@ripple-ts/eslint-parser': 'latest',
		'@ripple-ts/typescript-plugin': 'latest',
	};

	// Update dependencies
	if (packageJson.dependencies) {
		for (const [pkg, version] of Object.entries(latestVersions)) {
			if (packageJson.dependencies[pkg]) {
				packageJson.dependencies[pkg] = version;
			}
		}
	}

	// Update devDependencies
	if (packageJson.devDependencies) {
		for (const [pkg, version] of Object.entries(latestVersions)) {
			if (packageJson.devDependencies[pkg]) {
				packageJson.devDependencies[pkg] = version;
			}
		}
	}
}

/**
 * Update scripts based on package manager
 * @param {Package} packageJson - Package.json object
 */
function updateScripts(packageJson) {
	if (!packageJson.scripts) return;

	// Update format scripts to use the correct package manager
	if (packageJson.scripts.format) {
		packageJson.scripts.format = 'prettier --write .';
	}
	if (packageJson.scripts['format:check']) {
		packageJson.scripts['format:check'] = 'prettier --check .';
	}
}

/**
 * Get package manager version string
 * @param {Extract<PackageManager, 'yarn' | 'pnpm' | 'bun'>} packageManager - Package manager name
 * @returns {string} - Package manager with version
 */
function getPackageManagerVersion(packageManager) {
	const versions = {
		yarn: 'yarn@4.0.0',
		pnpm: 'pnpm@9.0.0',
		bun: 'bun@1.3.0',
	};
	return versions[packageManager] || packageManager;
}
