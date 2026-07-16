async function getBackendStatus() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    return response.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const backend = await getBackendStatus();

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-gray-900">
          实习生入职登记系统
        </h1>

        <div className="mt-8 border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900">系统状态</h2>

          <p className="mt-3 text-gray-700">前端：运行正常</p>

          <p className="mt-2 text-gray-700">
            后端：{backend?.status === "ok" ? "连接正常" : "连接失败"}
          </p>
        </div>
      </div>
    </main>
  );
}
