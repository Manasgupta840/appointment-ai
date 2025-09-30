"use client";

import { useState, useRef, useEffect } from "react";
import { generateUUID } from "@/utils/uuid";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Stethoscope,
  Heart,
  Eye,
  Sheet as Teeth,
  Brain,
  Activity,
  Shield,
  Mic,
  Send,
  Info,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TypingDots from "@/components/ui/TypingIndicator";
import { addMessage } from "@/services/appointment.service";

// Health services configuration
const HEALTH_SERVICES = [
  {
    id: "general",
    name: "General Checkup",
    icon: Stethoscope,
    duration: "30 min",
    price: "$150",
    description: "Comprehensive health examination",
    color: "bg-blue-500",
  },
  {
    id: "cardiology",
    name: "Cardiology",
    icon: Heart,
    duration: "45 min",
    price: "$200",
    description: "Heart and cardiovascular health",
    color: "bg-red-500",
  },
  {
    id: "ophthalmology",
    name: "Eye Examination",
    icon: Eye,
    duration: "30 min",
    price: "$120",
    description: "Complete eye health checkup",
    color: "bg-green-500",
  },
  {
    id: "dental",
    name: "Dental Care",
    icon: Teeth,
    duration: "45 min",
    price: "$180",
    description: "Oral health and dental examination",
    color: "bg-purple-500",
  },
  {
    id: "neurology",
    name: "Neurology",
    icon: Brain,
    duration: "60 min",
    price: "$250",
    description: "Neurological health assessment",
    color: "bg-indigo-500",
  },
  {
    id: "preventive",
    name: "Preventive Care",
    icon: Shield,
    duration: "30 min",
    price: "$100",
    description: "Preventive health screening",
    color: "bg-teal-500",
  },
];

// Message type for our chat
type Message = {
  id: string;
  type: "user" | "bot" | "system";
  content: string;
  timestamp: Date;
  service?: string;
  appointment?: any;
  isStreaming?: boolean;
};

export default function HealthCheckApp() {
  const [currentView, setCurrentView] = useState<"services" | "chat">(
    "services"
  );
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // One buffer + timer per bot message id
  const typeBuffersRef = useRef<Record<string, string[]>>({});
  const typeTimersRef = useRef<Record<string, number | null>>({});
  const typeActiveRef = useRef<Record<string, boolean>>({});

  const SILENCE_MS = 4000; // wait time after user stops speaking
  const silenceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      Object.values(typeTimersRef.current).forEach((t) => {
        if (t) window.clearTimeout(t);
      });
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    setSpeechSupported(!!SR);
    if (!SR) return;
    // Create once
    recognitionRef.current = new SR();
    if (recognitionRef.current == null) return;
    const rec = recognitionRef.current;

    // Important: keep session alive and get only final results
    rec.continuous = true; // was false
    rec.interimResults = false;
    rec.lang = "en-US";

    const armSilenceTimer = () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        try {
          rec.stop(); // triggers onend -> sets isListening=false
        } catch {}
      }, SILENCE_MS);
    };

    rec.onstart = () => {
      setIsListening(true);
      // If the user starts and stays silent, still give a grace period
      armSilenceTimer();
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Heard speech; reset the silence timer
      armSilenceTimer();

      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript;
      // Your existing pipeline
      sendMessage(transcript);
    };

    // Chrome fires this when it detects end of a speech segment
    rec.onspeechend = () => {
      // Don’t stop immediately; wait for the grace period
      armSilenceTimer();
    };

    rec.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      addBotMessage(
        "Sorry, I had trouble understanding your voice. Please try typing instead."
      );
    };

    // Cleanup on unmount
    return () => {
      if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Tune these to taste
  const BASE_DELAY_MS = 25; // normal characters
  const SPACE_DELAY_MS = 10; // spaces
  const PUNCT_DELAY_MS = 120; // pauses after . , ! ? ;

  function scheduleNext(id: string, delay: number, fn: () => void) {
    // Clear any existing timer for this id and schedule a new one
    if (typeTimersRef.current[id]) {
      window.clearTimeout(typeTimersRef.current[id]!);
    }
    typeTimersRef.current[id] = window.setTimeout(fn, delay);
  }

  function nextDelayForChar(ch: string) {
    if (ch === " ") return SPACE_DELAY_MS;
    if (/[.,!?;:]/.test(ch)) return PUNCT_DELAY_MS;
    if (ch === "\n") return PUNCT_DELAY_MS; // small pause at newlines
    return BASE_DELAY_MS;
  }

  function tickTypewriter(id: string) {
    const buf = typeBuffersRef.current[id];
    if (!buf || buf.length === 0) {
      typeActiveRef.current[id] = false;
      return;
    }

    // Take the next character
    const ch = buf.shift() as string;

    // Append 1 char to the targeted message
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: (m.content || "") + ch } : m
      )
    );

    // Schedule next char
    scheduleNext(id, nextDelayForChar(ch), () => tickTypewriter(id));
  }

  function enqueueTypewriter(id: string, text: string) {
    if (!typeBuffersRef.current[id]) typeBuffersRef.current[id] = [];
    typeBuffersRef.current[id].push(...splitWordsPreservingSpaces(text));
    if (!typeActiveRef.current[id]) {
      typeActiveRef.current[id] = true;
      tickTypewriter(id);
    }
  }

  // Optional: flush the queue instantly (e.g., on error or when you want to end fast)
  function flushTypewriter(id: string) {
    const buf = typeBuffersRef.current[id];
    if (!buf || buf.length === 0) return;
    const remainder = buf.join("");
    typeBuffersRef.current[id] = [];
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: (m.content || "") + remainder } : m
      )
    );
  }

  function cancelTypewriter(id: string) {
    if (typeTimersRef.current[id]) {
      window.clearTimeout(typeTimersRef.current[id]!);
      typeTimersRef.current[id] = null;
    }
    typeActiveRef.current[id] = false;
    typeBuffersRef.current[id] = [];
  }

  type StreamEvent =
    | { type: "begin"; metadata?: any }
    | { type: "item"; content?: string; delta?: string; metadata?: any }
    | { type: "data"; data?: any; metadata?: any } // for your booking_confirmed / no_slot / ask_time payloads
    | { type: "end"; metadata?: any }
    | { type: "error"; message?: string; metadata?: any };

  // Safely pull complete JSON objects from a running buffer.
  // Handles: `}{` concatenation and `\n` delimited JSON lines.
  function extractJsonObjects(input: string): { objects: any[]; rest: string } {
    const objects: any[] = [];
    let i = 0;
    let depth = 0;
    let start = -1;

    while (i < input.length) {
      const ch = input[i];

      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = input.slice(start, i + 1);
          try {
            objects.push(JSON.parse(candidate));
          } catch {
            // Not a complete/valid object, keep buffering
          }
          start = -1;
        }
      }
      i++;
    }

    const rest =
      depth === 0 ? input.slice(i) : input.slice(start === -1 ? i : start);
    return { objects, rest };
  }

  // Route each event coming from the stream
  function routeEvent(evt: StreamEvent, streamMsgId: string) {
    switch (evt.type) {
      case "begin":
        // no-op or show typing indicator if you want
        // ensure the bubble is in streaming state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId ? { ...m, isStreaming: true } : m
          )
        );
        break;

      case "item": {
        const chunk = evt.delta ?? evt.content ?? "";
        // OLD: appendToBotMessage(streamMsgId, chunk);
        enqueueTypewriter(streamMsgId, chunk);
        break;
      }

      case "data": {
        // Your structured responses
        const result = evt.data ?? {};
        if (result.type === "booking_confirmed") {
          const service = HEALTH_SERVICES.find(
            (s) => s.id === (result.payload?.serviceId ?? selectedService)
          );
          const msg =
            `✅ Appointment confirmed!\n\n` +
            `Service: ${service?.name ?? "—"}\n` +
            `Date & Time: ${result.payload?.slot}\n` +
            `Booking ID: ${result.payload?.bookingId}\n\n` +
            `You'll receive a confirmation email shortly.`;
          appendToBotMessage(streamMsgId, `\n\n${msg}`);
        } else if (result.type === "no_slot") {
          const list = (result.payload?.suggestedSlots ?? [])
            .map((s: string) => `• ${s}`)
            .join("\n");
          const msg =
            `\n\n❌ Sorry, that time slot is already booked.\n\n` +
            `Requested: ${result.payload?.requested}\n\n` +
            `Available alternatives:\n${list}\n\n` +
            `Please choose one of these times or suggest another.`;
          appendToBotMessage(streamMsgId, msg);
        } else if (result.type === "ask_time") {
          appendToBotMessage(
            streamMsgId,
            `\n\n${result.payload?.message ?? ""}`
          );
        }
        break;
      }

      case "end":
        finalizeStreamingMessage(streamMsgId);
        break;

      case "error":
        replaceBotMessage(streamMsgId, evt.message || "Something went wrong.");
        break;

      default:
        // Unknown event; ignore
        break;
    }
  }

  // Update helpers to mutate the last bot message's text
  function appendToBotMessage(id: string, chunk: string) {
    let updated = false;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          updated = true;
          return { ...m, content: (m.content || "") + chunk };
        }
        return m;
      })
    );
    if (!updated) console.warn("No bot message found for id:", id);
  }

  function replaceBotMessage(id: string, content: string) {
    cancelTypewriter(id);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content, isStreaming: false } : m))
    );
  }

  function finalizeStreamingMessage(id: string) {
    // noop for now; you could mark it as "complete" or remove a typing state
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isStreaming: false } : m))
    );
  }

  function splitWordsPreservingSpaces(s: string) {
    // chunks like ["Hello", " ", "world", "!"]
    return s.match(/(\s+|[^\s]+)/g) ?? [];
  }

  function nextDelayForChunk(chunk: string) {
    if (/^\s+$/.test(chunk)) return 25;
    if (/[.!?;:]\s*$/.test(chunk)) return 160;
    return 45; // word delay
  }

  const initializeChat = (serviceId: string) => {
    const service = HEALTH_SERVICES.find((s) => s.id === serviceId);
    if (!service) return;

    setSelectedService(serviceId);
    setCurrentView("chat");
    setMessages([
      {
        id: generateUUID(),
        type: "system",
        content: `Welcome to ${service.name}`,
        timestamp: new Date(),
      },
      {
        id: generateUUID(),
        type: "bot",
        content: `Hello! I'm here to help you book your ${service.name} appointment. You can tell me your preferred date and time, for example: "Book appointment for 2025-01-15 14:30" or use voice input.`,
        timestamp: new Date(),
        service: serviceId,
      },
    ]);
  };

  const addBotMessage = (
    content: string,
    appointment?: any,
    id?: string,
    isStreaming?: boolean
  ) => {
    const botMessage: Message = {
      id: id ?? generateUUID(),
      type: "bot",
      content,
      timestamp: new Date(),
      service: selectedService || undefined,
      appointment,
      isStreaming: !!isStreaming,
    };
    setMessages((prev) => [...prev, botMessage]);
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);

    // 1) push user message
    const userMessage: Message = {
      id: generateUUID(),
      type: "user",
      content: text,
      timestamp: new Date(),
      service: selectedService || undefined,
    };
    setMessages((prev) => [...prev, userMessage]);

    if (!messageText) setInputText("");

    // 2) prepare an in-flight bot message we can update as we stream
    const streamMsgId = generateUUID();
    addBotMessage("", undefined, streamMsgId, true); // create an empty bot bubble first
    // ensure the last bot message has a stable id we can update
    setMessages((prev) =>
      prev.map((m, i, arr) =>
        i === arr.length - 1 ? { ...m, id: streamMsgId } : m
      )
    );
    
    try {
      const response = await addMessage(text, selectedService);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // If the server did NOT stream, fall back to JSON once.
      if (!response.body) {
        return;
      }

      // 3) stream handling
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Extract as many complete JSON objects as possible from the buffer.
        // Works for NDJSON and concatenated JSON without delimiters.
        const { objects, rest } = extractJsonObjects(buffer);
        buffer = rest;

        for (const evt of objects) {
          routeEvent(evt, streamMsgId);
        }
      }

      // Flush any trailing bytes
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer);
          routeEvent(evt, streamMsgId);
        } catch {
          // ignore trailing partial
        }
      }

      // If the stream ended without an explicit "end", finalize the message.
      finalizeStreamingMessage(streamMsgId);
    } catch (error) {
      console.error("Error sending message:", error);
      replaceBotMessage(
        streamMsgId,
        "Sorry, I hit an error. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  console.log(isVoiceProcessing, "isVoiceProcessing");
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      try {
        const speechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!speechRecognition) {
          addBotMessage("Speech recognition is not supported in your browser.");
          return;
        }

        recognitionRef.current = new speechRecognition();
        recognitionRef.current.continuous = true; // Keep listening for multiple phrases
        recognitionRef.current.interimResults = false; // Only final results
        recognitionRef.current.lang = "en-US"; // You can set the language if needed

        let endTimeout: NodeJS.Timeout | undefined; // To handle delayed stop

        recognitionRef.current.onresult = async (event) => {
          const transcript =
            event.results[event.results.length - 1][0].transcript;
          clearTimeout(endTimeout); // Reset timer when user speaks again

          // Wait 3-4 seconds before closing if no further speech
          endTimeout = setTimeout(() => {
            recognitionRef.current?.stop();
          }, 4000); // 4 seconds of silence before stopping

          try {
            setIsVoiceProcessing(true);
            const response = await fetch(
              "https://manasgupta840.app.n8n.cloud/webhook-test/translator",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: "user-1",
                  message: transcript,
                  requestId: generateUUID(),
                  service: selectedService,
                }),
              }
            );
            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${response.statusText}`
              );
            }

            const result = await response.json();
            if (!!result[0].output) {
              setInputText(inputText + " " + result[0].output);
            }
          } catch (error) {
            console.error("Error sending message:", error);
            setInputText((input) => input + " " + transcript);
          } finally {
            setIsVoiceProcessing(false);
          }
        };

        recognitionRef.current.onend = () => {
          clearTimeout(endTimeout);
          setIsListening(false);
        };

        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        addBotMessage(
          "Speech recognition is not available. Please check your browser permissions and try again."
        );
      }
    }
  };

  const stopListening = () => {
    if (!speechSupported) return;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
      setIsListening(false);
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };
  console.log(messages, "messages");
  const renderServiceCard = (service: (typeof HEALTH_SERVICES)[0]) => {
    const IconComponent = service.icon;
    return (
      <div
        key={service.id}
        onClick={() => initializeChat(service.id)}
        className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 group"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div
              className={`p-3 rounded-lg ${service.color} text-white group-hover:scale-110 transition-transform duration-300`}
            >
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {service.price}
              </div>
              <div className="text-sm text-gray-500">{service.duration}</div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
            {service.name}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {service.description}
          </p>
          <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
            <Calendar className="w-4 h-4 mr-2" />
            Book Appointment
          </div>
        </div>
      </div>
    );
  };

  const renderMessage = (message: Message) => {
    if (message.type === "system") {
      return (
        <div key={message.id} className="flex justify-center mb-4">
          <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-full text-sm font-medium flex items-center">
            <Info className="w-4 h-4 mr-2" />
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`flex mb-4 ${
          message.type === "user" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`max-w-xs lg:max-w-md${
            message.type === "user" ? "order-2" : "order-1"
          }`}
        >
          {message.type === "bot" && (
            <div className="flex items-center mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-gray-600 font-medium">
                HealthCheck Assistant
              </span>
            </div>
          )}
          <div
            className={`px-4 py-3 rounded-2xl ${
              message.type === "user"
                ? "bg-blue-500 text-white rounded-br-md"
                : "bg-white text-gray-800 shadow-md border border-gray-100 rounded-bl-md"
            }`}
          >
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.type === "user" ? (
                <span>{message.content}</span>
              ) : message.isStreaming && !message.content ? (
                <TypingDots />
              ) : (
                <Markdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </Markdown>
              )}
              {/* {message.type !== "user" &&
              message.isStreaming &&
              message.content ? (
                <span className="inline-block w-2 h-4 align-baseline bg-gray-300 ml-0.5 animate-pulse" />
              ) : null} */}
            </div>
            <div
              className={`text-xs mt-2 ${
                message.type === "user" ? "text-blue-100" : "text-gray-500"
              }`}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (currentView === "services") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-blue-500 p-2 rounded-lg mr-4">
                  <Activity className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    HealthCheck
                  </h1>
                  <p className="text-gray-600">
                    Professional Healthcare Services
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2" />
                  (555) 123-4567
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  info@healthcheck.com
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Your Health, Our Priority
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Book your appointment with our experienced healthcare
              professionals. Choose from our comprehensive range of medical
              services.
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
              Our Services
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {HEALTH_SERVICES.map(renderServiceCard)}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center mb-4">
                  <Activity className="w-6 h-6 mr-2" />
                  <span className="text-lg font-semibold">HealthCheck</span>
                </div>
                <p className="text-gray-400">
                  Providing quality healthcare services with modern technology
                  and experienced professionals.
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">Contact Info</h4>
                <div className="space-y-2 text-gray-400">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    123 Health Street, Medical City
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    (555) 123-4567
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    info@healthcheck.com
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">Hours</h4>
                <div className="space-y-2 text-gray-400">
                  <div>Monday - Friday: 8:00 AM - 6:00 PM</div>
                  <div>Saturday: 9:00 AM - 4:00 PM</div>
                  <div>Sunday: Emergency Only</div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Chat View
  const selectedServiceData = HEALTH_SERVICES.find(
    (s) => s.id === selectedService
  );
  const IconComponent = selectedServiceData?.icon || Stethoscope;
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Chat Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setCurrentView("services")}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ←
              </button>
              <div
                className={`p-2 rounded-lg ${
                  selectedServiceData?.color || "bg-blue-500"
                } text-white mr-3`}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">
                  {selectedServiceData?.name || "HealthCheck Chat"}
                </h1>
                <p className="text-sm text-gray-600">
                  {selectedServiceData?.duration} • {selectedServiceData?.price}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-white"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message or use voice input..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSending}
              aria-label="Message input"
            />
          </div>

          {/* Microphone Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isSending}
              className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                isListening
                  ? "bg-red-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={
                isListening ? "Stop voice input" : "Start voice input"
              }
            >
              {isVoiceProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Mic
                  className={`w-5 h-5 ${isListening ? "animate-pulse" : ""}`}
                />
              )}
            </button>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            aria-label="Send message"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>

        {!speechSupported && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Voice input not supported in this browser
          </p>
        )}
      </div>
    </div>
  );
}
