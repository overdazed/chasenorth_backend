import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import { MongoClient } from 'mongodb'
import { callAgent } from './agent'

const app: Express = express()

import cors from 'cors'
app.use(cors())
app.use(express.json())

const client = new MongoClient(process.env.MONGO_URI)

// async function to initialize and start the server

async function startServer() {
    /*
    Initialize the agent
    Start the server
     */
    try {
        /* Establish connection to MongoDB Atlas */
        await client.connect()
        await client.db('admin').command({ ping: 1 })
        console.log('Connected to MongoDB')

        /* Define the root and point */
        app.get('/', (req: Request, res: Response) => {
            res.send('LangGraph Agent Server!')
        })

        app.post('/chat', async (req: Request, res: Response) => {
            // extract the user message from the request body
            const initialMessage = req.body.message
            const threadId = Date.now().toString()
            console.log(initialMessage)
            try {
                const response = await callAgent(client, initialMessage, threadId)
                // if successfull
                res.json({ threadId, response })
            } catch (error) {
                console.error(error)
            }
        })
    } catch (error) {
        console.error(error)
    }
}