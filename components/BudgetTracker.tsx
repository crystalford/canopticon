"use client"

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'

interface BudgetTrackerProps {
    monthlyLimit?: number;
}

// In a real implementation, this would fetch from an API that tracks OpenAI usage
// For now, we'll use a simple estimate based on local storage or mock data
export default function BudgetTracker({ monthlyLimit = 50 }: BudgetTrackerProps) {
    const [usage, setUsage] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate fetching usage data
        // In production, this would call an API endpoint that tracks OpenAI costs
        const storedUsage = localStorage.getItem('canopticon_api_usage');
        const currentMonth = new Date().getMonth();
        const storedMonth = localStorage.getItem('canopticon_usage_month');

        if (storedMonth && parseInt(storedMonth) !== currentMonth) {
            // Reset for new month
            localStorage.setItem('canopticon_api_usage', '0');
            localStorage.setItem('canopticon_usage_month', currentMonth.toString());
            setUsage(0);
        } else if (storedUsage) {
            setUsage(parseFloat(storedUsage));
        }

        setLoading(false);
    }, []);

    const percentage = Math.min((usage / monthlyLimit) * 100, 100);
    const isWarning = percentage > 75;
    const isCritical = percentage > 90;

    if (loading) {
        return (
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 animate-pulse">
                <div className="h-20"></div>
            </div>
        );
    }

    return (
        <div className={`p-5 rounded-2xl border ${isCritical ? 'bg-red-500/10 border-red-500/30' : isWarning ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/[0.02] border-white/10'}`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-white/5 ${isCritical ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-green-400'}`}>
                    {isCritical ? <AlertTriangle className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                </div>
                <span className="text-sm text-gray-400">API Budget</span>
            </div>

            <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold font-mono">${usage.toFixed(2)}</span>
                <span className="text-gray-500">/</span>
                <span className="text-gray-400">${monthlyLimit}</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full transition-all duration-500 ${isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
                <span>{percentage.toFixed(1)}% used</span>
                <span>${(monthlyLimit - usage).toFixed(2)} remaining</span>
            </div>

            {isCritical && (
                <div className="mt-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <p className="text-xs text-red-400">⚠️ Budget critical! Consider reducing API calls.</p>
                </div>
            )}
        </div>
    );
}

// Export a helper to increment usage (call this after API calls)
export function incrementUsage(amount: number = 0.002) {
    if (typeof window !== 'undefined') {
        const current = parseFloat(localStorage.getItem('canopticon_api_usage') || '0');
        localStorage.setItem('canopticon_api_usage', (current + amount).toFixed(4));
    }
}
