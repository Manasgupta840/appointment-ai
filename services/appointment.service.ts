const addMessage = async (message: string, serviceType: string | null) => {
  const response = await fetch(
    "https://manasgupta840.app.n8n.cloud/webhook-test/message",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        message: message,
        requestId: "12345",
        service: serviceType,
        // If your backend needs a hint to stream, pass a flag:
        // stream: true,
      }),
    }
  );
  return response;
};

export { addMessage };
