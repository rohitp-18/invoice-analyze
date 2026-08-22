"use client";

import React, { FormEvent, useState, useRef } from "react";
import {
  FileImage,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  X,
  FileUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import axios from "@/store/axios";
import { isAxiosError } from "axios";

export default function UploadInvoicePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgressStage, setUploadProgressStage] = useState<string>("");

  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  const handleFile = (file: File | null) => {
    if (!file) {
      setInvoiceFile(null);
      setFilePreview(null);
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg =
      file.type.startsWith("image/") ||
      [".png", ".jpg", ".jpeg", ".webp"].some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

    if (!isPdf && !isImg) {
      setErrorMessage("Please upload a supported format: PDF, PNG, JPG, JPEG, or WEBP.");
      setInvoiceFile(null);
      setFilePreview(null);
      return;
    }

    setErrorMessage("");
    setInvoiceFile(file);

    if (isImg) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  };

  const removeFile = () => {
    setInvoiceFile(null);
    setFilePreview(null);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!invoiceFile) {
      setErrorMessage("Please select an invoice file before submitting.");
      return;
    }

    const isPdf =
      invoiceFile.type === "application/pdf" ||
      invoiceFile.name.toLowerCase().endsWith(".pdf");

    // Route dynamically based on format
    const endpoint = isPdf ? "/invoice/upload/pdf" : "/invoice/upload/image";

    const formData = new FormData();
    formData.append("file", invoiceFile);

    try {
      setIsSubmitting(true);
      setUploadProgressStage("Uploading document payload to backend...");

      // Small simulation stage display for user feedback
      setTimeout(() => {
        setUploadProgressStage("Running Vision OCR & extracting structured items...");
      }, 1200);

      setTimeout(() => {
        setUploadProgressStage("Performing AI anomaly & policy checks in LangGraph...");
      }, 2500);

      // Call FastAPI Backend Endpoint
      const response = await axios.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = response.data;

      // Navigate to success page with query metadata
      const queryParams = new URLSearchParams({
        file: invoiceFile.name,
        invoice_id: data.invoice_id || "",
        invoice_number: data.invoice_number || "",
        vendor: data.vendor_name || "",
        amount: String(data.total_amount || 0),
        currency: data.currency || "USD",
        status: data.status || "PENDING_REVIEW",
        anomalies: String(data.anomalies_detected || 0),
      });

      setInvoiceFile(null);
      setFilePreview(null);
      router.push(`/invoice/success?${queryParams.toString()}`);
    } catch (error: unknown) {
      console.error("Invoice upload error:", error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          setErrorMessage(
            "Unauthorized session. Please log in first to upload and process invoices."
          );
        } else {
          setErrorMessage(
            error.response?.data?.detail ||
              "Upload failed. Please check the backend server status."
          );
        }
      } else {
        setErrorMessage("Upload failed. An unexpected error occurred.");
      }
    } finally {
      setIsSubmitting(false);
      setUploadProgressStage("");
    }
  }

  const isPdf =
    invoiceFile?.type === "application/pdf" ||
    invoiceFile?.name.toLowerCase().endsWith(".pdf");

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />

      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-4 py-12 md:py-16">
        <Card className="w-full max-w-2xl border-white/10 bg-slate-900/80 text-slate-100 backdrop-blur shadow-2xl">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="size-3.5" />
              Agentic AI Extraction & Audit
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Upload Invoice or Receipt
            </CardTitle>
            <CardDescription className="text-slate-300 max-w-md mx-auto mt-1 text-sm">
              Ingest PDF or image documents. Our LangGraph agent extracts line items, validates tax calculations, and detects spend anomalies in real time.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Drag & Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-950/20 scale-[1.01]"
                    : "border-white/15 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-950/60"
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="invoice-file-input"
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={onFileChange}
                  className="hidden"
                />

                <div className="flex size-14 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-3 text-cyan-300">
                  <UploadCloud className="size-7" />
                </div>

                <p className="text-sm font-semibold text-white">
                  Click to browse or drag & drop invoice
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Supports PDF documents, PNG, JPG, JPEG, and WEBP images
                </p>

                <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3" /> PDF Documents
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <FileImage className="size-3" /> Image Receipts
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Auto Anomaly Detection
                  </span>
                </div>
              </div>

              {/* Selected File Details Card */}
              {invoiceFile && (
                <div className="relative rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 shadow-sm">
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    title="Remove file"
                  >
                    <X className="size-4" />
                  </button>

                  <div className="flex items-start gap-4 pr-6">
                    {/* Thumbnail / Icon */}
                    {filePreview ? (
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                        <img
                          src={filePreview}
                          alt="Invoice Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                        <FileText className="size-8" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">
                          {invoiceFile.name}
                        </span>
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                          {isPdf ? "PDF" : "IMAGE"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        Size: {formatFileSize(invoiceFile.size)} • Target Route:{" "}
                        <span className="text-cyan-300 font-mono">
                          {isPdf ? "/invoice/upload/pdf" : "/invoice/upload/image"}
                        </span>
                      </p>

                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3.5" /> Ready for AI processing
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message Alert */}
              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 shrink-0 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">{errorMessage}</p>
                      {errorMessage.includes("log in") && (
                        <Link
                          href="/login"
                          className="mt-2 inline-block font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                        >
                          Go to Login Page →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-step progress indicator when submitting */}
              {isSubmitting && uploadProgressStage && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm text-cyan-200">
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-5 animate-spin text-cyan-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">AI Pipeline Running</p>
                      <p className="text-xs text-cyan-300 mt-0.5 animate-pulse">
                        {uploadProgressStage}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !invoiceFile}
                className="w-full h-11 text-base font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all shadow-lg shadow-cyan-950/40 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Processing with LangGraph...
                  </>
                ) : (
                  <>
                    <FileUp className="size-4 mr-2" />
                    Upload and Extract Data
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
