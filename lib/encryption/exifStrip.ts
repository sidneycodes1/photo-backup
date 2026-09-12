import { fileLooksLikeImageForExifStripping } from './helpers'

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    return image
  } catch (error) {
    throw new Error(`Failed to decode image for EXIF stripping: ${(error as Error).message}`)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  const targetType = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas did not produce a blob during EXIF stripping'))
        return
      }

      resolve(blob)
    }, targetType)
  })
}

export async function stripExif(file: File): Promise<File> {
  if (!fileLooksLikeImageForExifStripping(file.type)) {
    return file
  }

  try {
    const image = await loadImageFromFile(file)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to acquire a 2D canvas context for EXIF stripping')
    }

    context.drawImage(image, 0, 0)
    const blob = await canvasToBlob(canvas, file.type)
    return new File([blob], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })
  } catch (error) {
    throw new Error(`Failed to strip EXIF metadata from "${file.name}": ${(error as Error).message}`)
  }
}
