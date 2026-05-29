export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-gray-300">
      <h1 className="text-3xl font-bold mb-6 text-white">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">
        Last updated: {new Date().toLocaleDateString("de-DE")}
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
        <p className="mb-3">
          By accessing or using ContentOS, you agree to be bound by these Terms of
          Service. If you do not agree, you may not use the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
        <p className="mb-3">
          ContentOS is a content management platform that allows creators to:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Upload and temporarily store video content.</li>
          <li>Generate transcriptions, summaries, and semantic embeddings.</li>
          <li>Search content using AI-powered semantic search.</li>
          <li>Schedule and publish content to connected social media accounts.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            You must provide accurate information when registering.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your
            account credentials.
          </li>
          <li>
            You must be at least 16 years old to use the service.
          </li>
          <li>
            We reserve the right to suspend or terminate accounts that violate
            these terms.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">4. User Content</h2>
        <p className="mb-3">
          You retain ownership of all content you upload. By uploading content,
          you grant us a limited license to:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Store and process it for transcription and analysis.</li>
          <li>Generate embeddings for search functionality.</li>
          <li>Publish it to platforms you explicitly connect and authorize.</li>
        </ul>
        <p className="mt-3">
          You represent that you have all necessary rights to the content you
          upload and that it does not infringe third-party rights.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">5. Prohibited Uses</h2>
        <p className="mb-3">You may not use ContentOS to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Upload illegal, harmful, or copyrighted content without rights.</li>
          <li>Harass, abuse, or discriminate against others.</li>
          <li>Attempt to circumvent security measures.</li>
          <li>Use automated systems to access the service without authorization.</li>
          <li>Publish content that violates the terms of any connected platform.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">6. Platform Integration</h2>
        <p className="mb-3">
          When you connect social media accounts (TikTok, YouTube, LinkedIn,
          Instagram), you authorize us to:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Read account information necessary for publishing.</li>
          <li>Publish content on your behalf according to your instructions.</li>
          <li>Refresh authentication tokens as needed.</li>
        </ul>
        <p className="mt-3">
          You can revoke this authorization at any time by disconnecting the
          platform in your account settings.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">7. Disclaimers</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            The service is provided "as is" without warranties of any kind.
          </li>
          <li>
            We do not guarantee 100% uptime or error-free operation.
          </li>
          <li>
            We are not responsible for content removal or account suspension by
            third-party platforms.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
        <p className="mb-3">
          To the maximum extent permitted by law, our liability is limited to the
          amount you paid for the service in the 12 months preceding the claim,
          or €100, whichever is lower.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">9. Termination</h2>
        <p className="mb-3">
          You may terminate your account at any time. We may terminate or
          suspend your account for violations of these terms. Upon termination,
          your content will be deleted in accordance with our Privacy Policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">10. Changes to Terms</h2>
        <p className="mb-3">
          We may update these terms from time to time. We will notify you of
          significant changes via email or in-app notice.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">11. Governing Law</h2>
        <p className="mb-3">
          These terms are governed by the laws of Germany, without regard to
          conflict of law principles.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
        <p>For questions about these terms, contact:</p>
        <p className="mt-2">
          <strong>Email:</strong> legal@contentos.app
        </p>
      </section>
    </main>
  );
}
