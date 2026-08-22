"use client";

import { FormEvent, useState } from "react";
import { FileImage, FileText, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import axios from "@/store/axios";

export default function UploadInvoicePage() {
  const router = useRouter();
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setInvoiceFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        "Please upload a PDF or image file (PNG, JPG, JPEG, WEBP).",
      );
      setInvoiceFile(null);
      return;
    }

    setErrorMessage("");
    setInvoiceFile(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!invoiceFile) {
      setErrorMessage("Please choose an invoice file before submitting.");
      return;
    }

    const formData = new FormData();
    formData.append("file", invoiceFile);

    try {
      setIsSubmitting(true);

      await axios.post("/invoice/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const encodedFileName = encodeURIComponent(invoiceFile.name);
      setInvoiceFile(null);
      router.push(`/invoice/success?file=${encodedFileName}`);
    } catch (error) {
      setErrorMessage(
        "Upload failed. Please try again or check the API endpoint.",
      );
      console.error("Invoice upload error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <Navbar />

      <section className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_42%),radial-gradient(circle_at_80%_20%,_rgba(251,146,60,0.22),_transparent_36%)] px-6 py-16">
        <Card className="w-full max-w-2xl border-white/10 bg-slate-900/70 text-slate-100 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white md:text-3xl">
              Upload Invoice
            </CardTitle>
            <CardDescription className="text-slate-300">
              Upload a PDF or image invoice to extract structured details using
              AI.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invoice-file" className="text-slate-200">
                    Invoice file
                  </FieldLabel>
                  <Input
                    id="invoice-file"
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={onFileChange}
                    className="cursor-pointer border-white/10 text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-400 file:px-3 file:py-1 file:text-slate-950"
                  />
                  <FieldDescription className="text-slate-400">
                    Supported formats: PDF, PNG, JPG, JPEG, WEBP.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="flex items-center gap-2 font-medium text-slate-100">
                  {invoiceFile?.type === "application/pdf" ? (
                    <FileText className="size-4 text-cyan-300" />
                  ) : (
                    <FileImage className="size-4 text-cyan-300" />
                  )}
                  {invoiceFile ? "Selected file" : "No file selected"}
                </div>
                <p className="mt-1 break-all text-slate-400">
                  {invoiceFile
                    ? invoiceFile.name
                    : "Choose a file to continue."}
                </p>
              </div>

              {errorMessage ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {errorMessage}
                </p>
              ) : null}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                <UploadCloud className="size-4" />
                {isSubmitting ? "Uploading..." : "Upload and Extract"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
