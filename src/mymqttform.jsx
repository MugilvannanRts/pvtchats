import React, { useState, useEffect } from "react";
import mqtt from "mqtt";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperclip, faMicrophone, faMicrophoneSlash, faPaperPlane, faShieldHalved } from "@fortawesome/free-solid-svg-icons";

export default function MyMqttForm() {
    const [client, setClient] = useState(null);
    const [subTopic, setSubTopic] = useState("chatroom/#");
    const [pubTopic, setPubTopic] = useState("chatroom/mugil");
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [imageToUpload, setImageToUpload] = useState(null);
    const [lastSentMessage, setLastSentMessage] = useState("");

    function getFormattedTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    useEffect(() => {
        const mqttClient = mqtt.connect("wss://test.mosquitto.org:8081/mqtt");

        mqttClient.on("connect", () => {
            console.log("Connected to MQTT broker");
            mqttClient.subscribe(subTopic, (err) => {
                if (err) console.error("Subscription error:", err);
            });
        });

        mqttClient.on("message", (topic, message) => {
            const decodedMessage = message.toString();
            if (decodedMessage === lastSentMessage) return;

            let sender = topic.split('/')[1];
            const timestamp = getFormattedTime();

            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    topic: sender,
                    type: decodedMessage.startsWith("data:audio") ? "audio" :
                          decodedMessage.startsWith("data:image") ? "image" : "text",
                    content: decodedMessage,
                    time: timestamp,
                },
            ]);
        });

        mqttClient.on("error", (err) => console.error("Connection error:", err));
        setClient(mqttClient);

        return () => mqttClient.end();
    }, [lastSentMessage]);

    function handlePublish() {
        if (client && pubTopic && message) {
            const timestamp = getFormattedTime();
            client.publish(pubTopic, message, (err) => {
                if (!err) {
                    setMessages((prevMessages) => [
                        ...prevMessages,
                        { topic: "mugil", type: "text", content: message, time: timestamp },
                    ]);
                    setLastSentMessage(message);
                    setMessage("");
                }
            });
        }

        if (imageToUpload) {
            const reader = new FileReader();
            reader.readAsDataURL(imageToUpload);
            reader.onloadend = () => {
                const base64Image = reader.result;
                if (client && pubTopic) {
                    client.publish(pubTopic, base64Image);
                    setMessages((prevMessages) => [
                        ...prevMessages,
                        { topic: "mugil", type: "image", content: base64Image, time: timestamp },
                    ]);
                    setLastSentMessage(base64Image);
                    setImageToUpload(null);
                }
            };
        }
    }

    async function startRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: "audio/wav" });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = () => {
                const base64Audio = reader.result;
                if (client && pubTopic) {
                    client.publish(pubTopic, base64Audio);
                }
            };
        };

        recorder.start();
        setMediaRecorder(recorder);
        setIsRecording(true);
    }

    function stopRecording() {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) setImageToUpload(file);
    }

    return (
        <>
            <h1 className="text-2xl text-white p-3 text-center bg-gray-800">
                <FontAwesomeIcon icon={faShieldHalved} className="mr-2" style={{ color: "#fff", height: "24px", width: "24px" }} />
                Private Chat
            </h1>

            <div className="p-2 overflow-auto h-[calc(97vh-100px)] bg-[#E2DFFF]">
                {/* <div>
                    {messages.map((msg, index) => (
                        <div key={index} className={`shadow-lg bg-white rounded-xl p-3 mt-4 break-words 
                            ${msg.topic === "mugil" ? "ml-auto bg-green-200" : "mr-auto"} 
                            w-full sm:w-3/4 md:w-2/3 lg:w-1/2 xl:w-1/3`}>
                            <strong className="text-purple-600">{msg.topic}</strong> <br />
                            {msg.type === "text" && <p className="text-green-600">{msg.content}</p>}
                            {msg.type === "audio" && (
                                <audio controls className="w-full">
                                    <source src={msg.content} type="audio/mp3" />
                                    Your browser does not support the audio element.
                                </audio>
                            )}
                            {msg.type === "image" && (
                                <img src={msg.content} alt="Received" className="rounded-lg mt-2 w-full sm:w-auto max-w-xs cursor-pointer" />
                            )}
                            <span className="text-xs text-gray-500">{msg.time}</span>
                        </div>
                    ))}
                </div> */}
                <div>
                    {messages.map((msg, index) => (
                        <div key={index} className={`shadow-lg bg-white rounded-xl p-3 mt-6 break-words ${msg.topic === "mugil" ? "ml-auto bg-green-200" : "mr-auto"} w-full sm:w-1/2 md:w-1/5`}>
                            <strong className="text-purple-600">{msg.topic}</strong> <br />
                            {msg.type === "text" && (
                                <p className="text-green-600">{msg.content}</p>
                            )}

                            {msg.type === "audio" && (
                                <audio controls>
                                    <source src={msg.content} type="audio/mp3" />
                                    Your browser does not support the audio element.
                                </audio>
                            )}
                            {msg.type === "image" && (
                                <img
                                    src={msg.content}
                                    alt="Received"
                                    className="rounded-lg mt-2 max-w-xs cursor-pointer"
                                />
                            )}
                            <span className="text-xs text-gray-500">{msg.time}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 flex flex-col items-center shadow-lg">
                <div className="flex items-center w-full max-w-4xl">
                    <label htmlFor="imageUpload" className="cursor-pointer mr-2 p-2 rounded-md text-white bg-gray-100 shadow-xl">
                        <FontAwesomeIcon icon={faPaperclip} size="2x" style={{ color: "gray", height: "20px", width: "20px" }} />
                    </label>
                    <input type="file" accept="image/*" id="imageUpload" className="hidden" onChange={handleImageUpload} />
                    <input 
                        className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-full bg-white rounded-md shadow-xl border p-2" 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                        type="text" 
                        placeholder="Type your message" 
                    />

                    <button className="p-2 ml-2 cursor-pointer rounded-md text-white bg-gray-100 shadow-xl"
                        onClick={isRecording ? stopRecording : startRecording}>
                        <FontAwesomeIcon icon={isRecording ? faMicrophone : faMicrophoneSlash} style={{ color: "black", height: "24px", width: "24px" }} />
                    </button>
                    <button className="p-2 ml-2 cursor-pointer rounded-md text-white bg-gray-100 shadow-xl" onClick={handlePublish}>
                        <FontAwesomeIcon icon={faPaperPlane} style={{ color: "#0A88FF", height: "24px", width: "24px"}} />
                    </button>
                </div>
            </div>
        </>
    );
}
