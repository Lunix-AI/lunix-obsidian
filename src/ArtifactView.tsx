import type { Plugin } from "obsidian";
import ArtifactFrame from "~/tools/artifacts/ArtifactFrame";

export const ArtifactView = ({
	src,
	plugin,
}: {
	src: string;
	plugin: Plugin;
}) => {
	return null;
	// return (
	// 	<div
	// 		style={{
	// 			width: "100%",
	// 			height: "100%",
	// 		}}
	// 	>
	// 		<ArtifactFrame
	// 			code={src}
	// 			plugin={plugin}
	// 			app={plugin.app}
	// 			completed={false}
	// 		/>
	// 	</div>
	// );
};
