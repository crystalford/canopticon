"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await signIn("credentials", {
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Invalid password");
        } else {
            router.push("/admin/investigations");
            router.refresh();
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="w-[400px] border p-8 rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Admin Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input"
                    />
                    {error && <div className="text-red-500 text-sm">{error}</div>}
                    <Button type="submit" className="w-full">Sign In</Button>
                </form>
            </div>
        </div>
    );
}
