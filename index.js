import express from 'express'
import cors from 'cors'
const app = express()
const port = 8000

app.use(cors())

app.get('/', (req,res) => {
    res.send('Server is running properly')
})

app.listen(port , () => {
    console.log(`Server is running properly at : ${port}`);
    
})