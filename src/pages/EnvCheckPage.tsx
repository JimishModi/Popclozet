import React, { useEffect, useState } from 'react';

export const EnvCheckPage: React.FC = () => {
    const [envVars, setEnvVars] = useState<Record<string, string>>({});

    useEffect(() => {
        setEnvVars({
            SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'NOT SET',
            SUPABASE_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET (hidden)' : 'NOT SET',
            MAPPLS_PROXY: import.meta.env.VITE_SUPABASE_URL ? 'SET via Edge Function' : 'NOT SET',
            APP_NAME: import.meta.env.VITE_APP_NAME || 'NOT SET',
            APP_URL: import.meta.env.VITE_APP_URL || 'NOT SET',
        });
    }, []);

    const isCorrect = envVars.SUPABASE_URL &&
        envVars.SUPABASE_URL !== 'NOT SET' &&
        !envVars.SUPABASE_URL.includes('your-project');

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="container-custom max-w-4xl">
                <h1 className="text-3xl font-display font-bold text-gray-900 mb-6">
                    🔍 Environment Variables Check
                </h1>

                <div className={`card mb-6 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h2 className="text-xl font-semibold mb-4">
                        {isCorrect ? '✅ Environment Loaded Correctly' : '❌ Environment Issue Detected'}
                    </h2>

                    <div className="space-y-3">
                        {Object.entries(envVars).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center p-3 bg-white rounded">
                                <span className="font-mono text-sm">{key}:</span>
                                <span className={`font-mono text-sm ${value === 'NOT SET' ? 'text-red-600' :
                                        value.includes('your-project') ? 'text-red-600' :
                                            'text-green-600'
                                    }`}>
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {!isCorrect && (
                    <div className="card bg-yellow-50 border-yellow-200">
                        <h3 className="text-lg font-semibold text-yellow-900 mb-3">
                            ⚠️ Action Required
                        </h3>
                        <div className="space-y-2 text-sm text-yellow-800">
                            <p>Your Supabase URL is showing as: <code className="bg-yellow-100 px-2 py-1 rounded">{envVars.SUPABASE_URL}</code></p>
                            <p className="font-semibold mt-4">To fix this:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-4">
                                <li>Stop the dev server (Ctrl+C in terminal)</li>
                                <li>Verify your <code>.env</code> file has the correct URL</li>
                                <li>Restart: <code className="bg-yellow-100 px-2 py-1 rounded">npm run dev</code></li>
                                <li>Hard refresh this page (Ctrl+Shift+R)</li>
                            </ol>
                        </div>
                    </div>
                )}

                {isCorrect && (
                    <div className="card bg-green-50 border-green-200">
                        <h3 className="text-lg font-semibold text-green-900 mb-3">
                            ✅ Next Steps
                        </h3>
                        <div className="space-y-2 text-sm text-green-800">
                            <p>Your environment is configured correctly!</p>
                            <p className="font-semibold mt-4">Now you need to:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-4">
                                <li>Run the database migration in Supabase SQL Editor</li>
                                <li>Enable Realtime on <code>orders</code> and <code>rider_locations</code> tables</li>
                                <li>Try signing up at <a href="/signup" className="text-green-600 underline">/signup</a></li>
                            </ol>
                        </div>
                    </div>
                )}

                <div className="card mt-6">
                    <h3 className="text-lg font-semibold mb-3">Expected Values</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                        <p><strong>SUPABASE_URL should be:</strong></p>
                        <code className="block bg-gray-100 p-2 rounded mt-1">
                            https://nbdbvlrqnsllajfwxjfl.supabase.co
                        </code>

                        <p className="mt-4"><strong>SUPABASE_URL should NOT be:</strong></p>
                        <code className="block bg-red-100 p-2 rounded mt-1 text-red-700">
                            https://your-project.supabase.co
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
};
