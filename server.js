import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = join(__dirname, 'dist')

const app = express()

app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

app.use(express.static(dist))

app.get('*', (_req, res) => {
  res.sendFile(join(dist, 'index.html'))
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Listening on port ${port}`))
