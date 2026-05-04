const MAX_IMAGE_SIZE = 250
const JPEG_QUALITY = 0.68

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Slika nije mogla da se učita.'))
    }

    img.src = objectUrl
  })
}

export async function compressProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Izabrani fajl nije slika.')
  }

  const img = await loadImage(file)
  let { width, height } = img

  if (width > height && width > MAX_IMAGE_SIZE) {
    height = Math.round(height * (MAX_IMAGE_SIZE / width))
    width = MAX_IMAGE_SIZE
  } else if (height >= width && height > MAX_IMAGE_SIZE) {
    width = Math.round(width * (MAX_IMAGE_SIZE / height))
    height = MAX_IMAGE_SIZE
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Browser ne podržava kompresiju slike.')

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
