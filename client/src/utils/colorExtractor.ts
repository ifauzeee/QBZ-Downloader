export const extractRGB = (imgUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        const timeout = setTimeout(() => {
            img.src = '';
            resolve('99, 102, 241');
        }, 3000);

        img.onload = () => {
            clearTimeout(timeout);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('99, 102, 241');
                return;
            }

            canvas.width = 10;
            canvas.height = 10;
            ctx.drawImage(img, 0, 0, 10, 10);

            const imageData = ctx.getImageData(0, 0, 10, 10).data;
            let r = 0, g = 0, b = 0;
            let count = 0;

            for (let i = 0; i < imageData.length; i += 4) {
                const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
                if (brightness > 30 && brightness < 230) {
                    r += imageData[i];
                    g += imageData[i + 1];
                    b += imageData[i + 2];
                    count++;
                }
            }

            if (count === 0) {
                ctx.drawImage(img, 0, 0, 1, 1);
                const data = ctx.getImageData(0, 0, 1, 1).data;
                resolve(`${data[0]}, ${data[1]}, ${data[2]}`);
                return;
            }

            resolve(`${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            resolve('99, 102, 241');
        };

        img.src = imgUrl;
    });
};
