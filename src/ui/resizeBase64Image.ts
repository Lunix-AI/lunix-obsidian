const tempCanvas = document.createElement('canvas');

tempCanvas.width = 400;
tempCanvas.height = 400;

const context = tempCanvas.getContext('2d')!;

function getResizedBase64Image(loadedImage: HTMLImageElement) {
	context.drawImage(loadedImage, 0, 0, 400, 400);
	return tempCanvas.toDataURL('image/png');
}

export async function resizeBase64Image(image64Url: string) {
	// resize the image to be 400x400
	const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
		const img = document.createElement('img');
		img.onload = () => {
			resolve(img);
		}
		img.onerror = reject;

		img.src = image64Url;
	});

	return getResizedBase64Image(loadedImage);
}
