import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import fastifyMultipart from "@fastify/multipart";
import path from "node:path"
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream";
import { promisify } from "node:util";

const pump = promisify(pipeline);


export async function uploadVideoRoute(app: FastifyInstance) {
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 1_048_576 + 25 //25mb,
    },
  });
  app.post("/videos", async (req, reply) => {
    const data = await req.file();

    if(!data) {
      return reply.status(400).send({
        error: "No file uploaded",
      });
    }
    const extension = path.extname(data.filename);
  
    if(extension !== ".mp3") {
      return reply.status(400).send({
        error: "Invalid file type, please upload a MP3",
      });
    }	

    const fileBaseName = path.basename(data.filename, extension);
    const fileUploadName = `${fileBaseName}-${randomUUID()}${extension}`;
    const uploadDestination = path.resolve(__dirname, "../../tmp", fileUploadName);

    await pump(data.file, fs.createWriteStream(uploadDestination));

    const video = await prisma.video.create({
      data: {
        name: fileBaseName,
        path: uploadDestination,
      },
    });

    return reply.status(200).send({
      video
    });
  });
}