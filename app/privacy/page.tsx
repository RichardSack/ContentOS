export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-gray-300">
      <h1 className="text-3xl font-bold mb-6 text-white">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">
        Last updated: {new Date().toLocaleDateString("de-DE")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
        <p className="mb-3">
          ContentOS is a content management and social media publishing platform
          operated by us. This Privacy Policy explains how we collect, use,
          store, and protect your personal information when you use our service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Account Information:</strong> Email address, display name,
            and password (hashed) when you register.
          </li>
          <li>
            <strong>Content Data:</strong> Videos, titles, descriptions, captions,
            and transcripts that you upload or create.
          </li>
          <li>
            <strong>OAuth Tokens:</strong> Access tokens and refresh tokens for
            connected social media platforms (TikTok, YouTube, LinkedIn,
            Instagram). These are encrypted at rest and stored securely.
          </li>
          <li>
            <strong>Usage Data:</strong> Search queries, processing job logs,
            and platform usage statistics to improve our service.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>To provide the core service: upload, process, and publish content.</li>
          <li>To authenticate you and manage your account.</li>
          <li>To generate semantic search embeddings using OpenAI.</li>
          <li>To transcribe videos using AssemblyAI.</li>
          <li>To publish content to your connected social platforms.</li>
          <li>To improve our algorithms and user experience.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
        <p className="mb-3">We use the following subprocessors:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Supabase</strong> — Database, authentication, and file
            storage. Located in EU (Frankfurt) for EU users.
          </li>
          <li>
            <strong>OpenAI</strong> — Text embeddings and summary generation.
          </li>
          <li>
            <strong>AssemblyAI</strong> — Video transcription services.
          </li>
          <li>
            <strong>Social Platforms</strong> — TikTok, YouTube, LinkedIn,
            Instagram (only when you explicitly connect your accounts).
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention & Deletion</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Uploaded videos are stored temporarily (max 24–48 hours) and
            deleted automatically after successful processing and publication.
          </li>
          <li>
            Content metadata, transcripts, and embeddings are retained until
            you delete your account.
          </li>
          <li>
            OAuth tokens are deleted when you disconnect a platform account.
          </li>
          <li>
            You can request complete account deletion at any time via email.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights (GDPR)</h2>
        <p className="mb-3">You have the right to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Access your personal data.</li>
          <li>Rectify inaccurate data.</li>
          <li>Erase your data ("right to be forgotten").</li>
          <li>Restrict or object to processing.</li>
          <li>Data portability.</li>
          <li>Withdraw consent for optional processing.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
        <p>
          For privacy-related questions or data requests, contact us at:
        </p>
        <p className="mt-2">
          <strong>Email:</strong> privacy@contentos.app
        </p>
      </section>
    </main>
  );
}
