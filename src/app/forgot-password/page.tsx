"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { getTranslator, readClientLocale, type Locale } from "@/lib/i18n"

export default function ForgotPasswordPage() {
  const [locale] = useState<Locale>(() => readClientLocale())
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const t = useMemo(() => getTranslator(locale), [locale])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!email.trim()) {
      setError(t("email") || "Email is required")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(t("passwordResetEmailSent") || "Email sent successfully")
        setEmailSent(true)
        setEmail("")
      } else {
        setError(data.error || (t("passwordResetEmailError") || "Error sending email"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (t("passwordResetEmailError") || "Error sending email"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 text-center">
            {t("resetPassword") || "Reset Password"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
            {t("resetPasswordSubtitle") || "Enter your email to receive a reset link"}
          </p>

          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t("email") || "Email"}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium transition disabled:cursor-not-allowed"
              >
                {loading ? t("sending") || "Sending..." : t("resetPasswordButton") || "Send Reset Link"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-green-600 dark:text-green-400 text-sm">
                  {message}
                </p>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm text-center">
                Check your email inbox for the reset link
              </p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-center text-slate-600 dark:text-slate-400 text-sm mb-3">
              {t("alreadyHaveAccount") || "Already have an account?"}
            </p>
            <Link
              href="/login"
              className="block text-center px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium transition"
            >
              {t("signIn") || "Sign In"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
