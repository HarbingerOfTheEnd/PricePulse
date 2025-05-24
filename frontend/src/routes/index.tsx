import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserPlus, LogIn } from "lucide-react";

export const Route = createFileRoute("/")({
    component: App,
});

function App(): ReactNode {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-200 p-4">
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-10 max-w-md w-full space-y-8 text-center">
                <h1 className="text-4xl font-bold text-gray-800">
                    Welcome to Amazon Price Tracker
                </h1>
                <p className="text-gray-600">
                    Track product prices over time with ease.
                </p>

                <div className="space-y-4">
                    <Link
                        to="/signup"
                        className="flex items-center justify-center gap-2 px-6 py-3 text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                    >
                        <UserPlus className="w-5 h-5" />
                        Sign Up
                    </Link>
                    <Link
                        to="/login"
                        className="flex items-center justify-center gap-2 px-6 py-3 text-lg font-medium text-indigo-600 border border-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    >
                        <LogIn className="w-5 h-5" />
                        Log In
                    </Link>
                </div>
            </div>
        </div>
    );
}
