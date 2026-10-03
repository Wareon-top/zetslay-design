/* Raster covers: preserve small originals, resize large files without cropping. */
const PLUGIN_COVER_LIMITS = Object.freeze({ inputBytes: 10 * 1024 * 1024, outputBytes: 2 * 1024 * 1024, originalSide: 4096, renderSide: 2560, pixels: 40_000_000, quality: 0.92 });
const PLUGIN_COVER_DATA_URL_LIMIT = 4 * Math.ceil(PLUGIN_COVER_LIMITS.outputBytes / 3) + 32;

function isPluginCoverDataUrl(value) {
  if (typeof value !== 'string' || value.length > PLUGIN_COVER_DATA_URL_LIMIT) return false;
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[1].length % 4 !== 0) return false;
  const padding = match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0;
  return match[1].length / 4 * 3 - padding <= PLUGIN_COVER_LIMITS.outputBytes;
}

function readPluginCoverBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => isPluginCoverDataUrl(reader.result) ? resolve(reader.result) : reject(new Error('Обложка превышает 2 МБ или имеет неподдерживаемый формат'));
    reader.onerror = reader.onabort = () => reject(new Error('Не удалось прочитать изображение. Выберите файл повторно.'));
    reader.readAsDataURL(blob);
  });
}

async function preparePluginCover(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > PLUGIN_COVER_LIMITS.inputBytes) throw new Error('Выберите PNG, JPEG или WebP до 10 МБ');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Не удалось открыть изображение. Проверьте, что файл не повреждён.'); }
  try {
    const { width, height } = bitmap;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > PLUGIN_COVER_LIMITS.pixels) throw new Error('Изображение слишком большое: допустимо до 40 млн пикселей');
    if (file.size <= PLUGIN_COVER_LIMITS.outputBytes && Math.max(width, height) <= PLUGIN_COVER_LIMITS.originalSide) return await readPluginCoverBlob(file);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не смог обработать изображение');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    let scale = Math.min(1, PLUGIN_COVER_LIMITS.renderSide / width, PLUGIN_COVER_LIMITS.renderSide / height);
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      // Canvas resizing resets the context, including its smoothing settings.
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Браузер не смог сохранить изображение')), 'image/webp', PLUGIN_COVER_LIMITS.quality));
      if (blob.size <= PLUGIN_COVER_LIMITS.outputBytes) return await readPluginCoverBlob(blob);
      scale *= 0.85;
    }
    throw new Error('Не удалось сохранить обложку до 2 МБ с высоким качеством. Уменьшите исходный файл.');
  } finally { bitmap.close(); }
}
