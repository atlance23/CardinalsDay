import { useState, useEffect, useRef } from 'react';
import { Main } from "../scripts.ts";

export default function Hero() {
    const [score, setScore] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef<boolean>(false);

    const fetchRuns = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await Main();
            setScore(result);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch runs';
            setError(errorMessage);
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Prevent double fetch in Strict Mode
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchRuns();
        }
    }, []);

    return (
        <section style={{marginTop: "70px", backgroundImage: "url('https://www.abovealllighting.com/Uploads/202201/PADserieMobilGasStation1.jpg')", backgroundSize: "cover", backgroundPosition: "center center", display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center"}} className="container-fluid vh-100 p-3">
            <div style={{backgroundColor: '#FFF', borderRadius: "20px", minHeight: "300px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"}} className="score">
                {loading ? (
                    <p className='text-dark'>Loading runs...</p>
                ) : error ? (
                    <div>
                        <p className='text-danger'>Error: {error}</p>
                        <button onClick={fetchRuns} className="btn btn-primary">Retry</button>
                    </div>
                ) : (
                    <>
                        <p className='text-dark d-flex align-items-center justify-content-center' style={{textTransform: "uppercase", fontSize: "2rem", fontWeight: "bold", whiteSpace: "pre"}}>
                            Runs Scored: {score >= 6 ? <span style={{color: "#FF0000"}}> {score}</span> : <span style={{color: "#00FF00"}}> {score}</span>}
                        </p>
                        <div style={{fontSize: '1.25rem', fontWeight: '500', textTransform: "uppercase"}}>
                            {score >= 6 ? <span>It's Cardinals Day!</span> : <span>It's <b><u>NOT</u></b> Cardinal's Day</span>}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}