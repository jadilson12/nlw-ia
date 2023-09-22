import { FileVideo, Upload } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = "waiting" | "converting" | "uploading" | "generating" | "success";

const statusMessages = {
  converting: "Convertendo...",
  uploading: "Carregando...",
  generating: "Transcrevendo...",
  success: "Sucesso!",
};

interface VideoInputFormProps {
  onVideoUloaded: (videoId: string) => void;
}

export function VideoInputForm(props: VideoInputFormProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [state, setState] = useState<Status>("waiting");

  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget;

    if (!files) {
      return;
    }
    const selectedFile = files[0];

    setVideoFile(selectedFile);
  }

  async function convertVideoToAudio(videoFile: File) {
    console.log("Convert started...");
    const ffmpeg = await getFFmpeg();

    await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

    // ffmpeg.on("log", (log) => console.log(log));

    ffmpeg.on("progress", (progress) => {
      console.log("Convert progress: " + Math.round(progress.progress * 100));
    });

    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-map",
      "0:a",
      "-b:a",
      "20k",
      "-acodec",
      "libmp3lame",
      "output.mp3",
    ]);
    const data = await ffmpeg.readFile("output.mp3");
    const audioFileBlob = new Blob([data], { type: "audio/mpeg" });
    const audioFile = new File([audioFileBlob], "output.mp3", {
      type: "audio/mpeg",
    });

    console.log("Convert finished!");

    return audioFile;
  }

  const previewURL = useMemo(() => {
    if (!videoFile) {
      return null;
    }

    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const prompt = promptInputRef.current?.value;

    if (!videoFile) {
      return;
    }

    setState("converting");

    const audioFile = await convertVideoToAudio(videoFile);

    const data = new FormData();
    data.append("file", audioFile);

    setState("uploading");
    const response = await api.post("/videos", data);

    setState("generating");
    const videoId = response.data.video.id;
    await api.post(`video/${videoId}/transcription`, {
      prompt,
    });

    setState("success");

    props.onVideoUloaded(videoId);
  }

  return (
    <form onSubmit={handleUploadVideo} className="space-y-6">
      <label
        htmlFor="video"
        className="relative border flex rounded-md aspect-video cursor-pointer border-dashed  text-sm flex-col items-center justify-center  text-muted-foreground hover:bg-primary/5"
      >
        {previewURL ? (
          <video
            src={previewURL}
            className="pointer-events-none absolute inset-0"
            controls={false}
          />
        ) : (
          <>
            <FileVideo className="w-8 h-8" />
            Seleccione um video
          </>
        )}
      </label>
      <input
        type="file"
        id="video"
        accept="video/mp4"
        className="sr-only"
        onChange={handleFilesSelected}
      />

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
        <Textarea
          ref={promptInputRef}
          disabled={state !== "waiting"}
          id="transcription_prompt"
          className="h-20 leading-relaxed resize-none"
          placeholder="Inclua palavras-chave  mencionada por virgulas (,)"
        ></Textarea>
      </div>
      <Button
        data-success={state === "success"}
        disabled={state !== "waiting"}
        type="submit"
        className="w-full data-[success=true]:bg-emerald-100"
      >
        {state === "waiting" ? (
          <>
            Carregar video
            <Upload className="w-4 h-4 ml-2" />
          </>
        ) : (
          statusMessages[state]
        )}
      </Button>
    </form>
  );
}
