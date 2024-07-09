import { Platform } from "obsidian";
import {
	type App,
	type Component,
	MarkdownRenderer,
	type Plugin,
} from "obsidian";
import type React from "react";
import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { CanvasTextNode } from "~/shared/types";
import type { ArtifactNodeData } from "~/types/LunixNodeData";
import stackblitzIframeHTML from "./stackblitzIframe.html";

const sandboxParams = [
	"allow-scripts",
	"allow-modals",
	"allow-popups",
	"allow-forms",
	"allow-same-origin",
].join(" ");

const BlobIframe: React.FC<{ html: string }> = ({ html }) => {
	const [blobUrl, setBlobUrl] = useState<string | null>(null);

	useEffect(() => {
		const blob = new Blob([html], { type: "text/html" });
		const blobUrl = URL.createObjectURL(blob);

		setBlobUrl(blobUrl);

		return () => {
			URL.revokeObjectURL(blobUrl);
		};
	}, [html]);

	if (!blobUrl) {
		return null;
	}

	return (
		<iframe
			src={blobUrl}
			style={{
				width: "100%",
				height: "100%",
				border: "none",
				background: "white",
			}}
			sandbox={sandboxParams}
			title="Dynamic Component"
		/>
	);
};

const ArtifactPreview: React.FC<{
	code: string;
	node: CanvasTextNode<ArtifactNodeData>;
}> = ({ code, node }) => {
	const [processedHTML, setProcessedHTML] = useState<string | null>(null);
	const [useTemplate, setUseTemplate] = useState(() => {
		const dataUseTemplate = node.getData().useTemplate;
		if (dataUseTemplate === undefined) {
			return true;
		}

		return dataUseTemplate;
	});
	const nonce = `window-nonce-${useId()}`;

	useEffect(() => {
		(async () => {
			try {
				const cdn = "https://esm.sh"; // alternative: esm.run

				const importMap: Record<string, string> = {
					"@babel/standalone": `${cdn}/@babel/standalone@7.24.7`,
					"@babel/plugin-syntax-jsx": `${cdn}/@babel/plugin-syntax-jsx`,
					"@stackblitz/sdk":
						"https://unpkg.com/@stackblitz/sdk@1/bundles/sdk.m.js",
				};

				// replace '<!-- IMPORTMAP -->' with the import map
				let processedHTML = stackblitzIframeHTML.replace(
					"<!-- IMPORTMAP -->",
					`<script type="importmap">${JSON.stringify(
						{
							imports: importMap,
						},
						null,
						2,
					)}</script>`,
				);

				// replace <!-- MAIN_SCRIPT --> with the bootstrap code
				// the transformed code will be converted to a string to be passed to defineComponentCode.

				let hacks = "";
				if (Platform.isAndroidApp) {
					// let's hack localStorage into the window

					hacks += `
(function() {
          var storage = {};
          Object.defineProperty(window, 'localStorage', {
            value: {
              setItem: function(key, value) {
                storage[key] = value;
              },
              getItem: function(key) {
                return storage[key] || null;
              },
              removeItem: function(key) {
                delete storage[key];
              },
              clear: function() {
                storage = {};
              },
              key: function(i) {
                return Object.keys(storage)[i] || null;
              },
              get length() {
                return Object.keys(storage).length;
              }
            },
            writable: false,
            configurable: false
          });
        })();`;
				}

				processedHTML = processedHTML.replace(
					"<!-- MAIN_SCRIPT -->",
					`<script type="module">
							defineComponentCode(${JSON.stringify(code)});
							window.nonce = ${JSON.stringify(nonce)};
							window.useTemplate = ${JSON.stringify(useTemplate)};
							${hacks}
						</script>`,
				);

				setProcessedHTML(processedHTML);
			} catch (e) {
				console.error("Error while trying to fix code", e);
				throw e;
			}
		})();

		const messageListener = (event: MessageEvent) => {
			const data = event.data;

			if (data.nonce === nonce) {
				if (data.action === "templateDidNotWork") {
					setUseTemplate(false);

					node.setData({
						...node.getData(),
						useTemplate: false,
					} satisfies ArtifactNodeData);

					node.canvas.requestSave();
				}
			}
		};

		window.addEventListener("message", messageListener);

		return () => {
			window.removeEventListener("message", messageListener);
		};
	}, [code, nonce, useTemplate, node]);

	if (!processedHTML) {
		return null;
	}

	if (Platform.isAndroidApp) {
		// blob urls don't work in Android: https://github.com/ionic-team/capacitor/issues/6377, so fall back to a srcDoc

		return (
			<iframe
				srcDoc={processedHTML}
				style={{
					width: "100%",
					height: "100%",
					border: "none",
					background: "white",
				}}
				sandbox={sandboxParams}
				title="Dynamic Component"
			/>
		);
	}

	return <BlobIframe html={processedHTML} />;
};

const ActualView: React.FC<{
	container: HTMLDivElement;
	code: string;
	app: App;
	component: Component;
}> = ({ container, code, app, component }) => {
	const state = useRef({
		rendering: false,
		queuedRender: false,
	});

	const tryRender = useCallback(
		async (code: string) => {
			// MarkdownRenderer.render(app, code, div.current, ".", null);
			const current = state.current;
			if (current.rendering) {
				current.queuedRender = true;
				return;
			}

			current.rendering = true;

			try {
				container.innerHTML = "";
				await MarkdownRenderer.render(
					app,
					`\`\`\`jsx\n${code}\n\`\`\``,
					container,
					".",
					component,
				);
			} finally {
				current.rendering = false;
				if (current.queuedRender) {
					current.queuedRender = false;
					await tryRender(code);
				}
			}
		},
		[app, container, component],
	);

	useEffect(() => {
		tryRender(code).catch(console.error);
	}, [code, tryRender]);

	return null;
};

const ArtifactCodePreview: React.FC<{
	code: string;
	app: App;
	component: Plugin;
}> = ({ code, app, component }) => {
	const div = useRef() as MutableRefObject<HTMLDivElement>;

	const [current, setCurrent] = useState<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		setCurrent(div.current);
	}, [div]);

	return (
		<>
			<div ref={div} />
			{current && (
				<ActualView
					container={current}
					code={code}
					app={app}
					component={component}
				/>
			)}
		</>
	);
};

const ArtifactFrame: React.FC<{
	code: string;
	plugin: Plugin;
	app: App;
	completed: boolean;
	node: CanvasTextNode<ArtifactNodeData>;
}> = ({ code, plugin, app, completed, node }) => {
	const [completionState, setCompletionState] = useState(completed);

	useEffect(() => {
		setCompletionState(completed);
	}, [completed]);

	if (!completionState) {
		return <ArtifactCodePreview code={code} app={app} component={plugin} />;
	}

	return <ArtifactPreview code={code} node={node} />;
};

export default ArtifactFrame;
