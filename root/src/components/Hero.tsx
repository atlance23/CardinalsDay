import { useState, useEffect } from 'react';
import { Main } from "../scripts.ts";

export default function Hero() {

    const [score, setScore] = useState<number>(0);

    const fetchRuns = async () => {
        try {
            const result = await Main();
            setScore(result);
        } finally {
            return;
        }
    };

    useEffect(() => {
        fetchRuns();  // ✅ Call the function inside useEffect
    }, []); // Empty dependency array means run once on component mount

  
    return (
        <>
            <section style={{marginTop: "70px", backgroundImage: "url('https://www.abovealllighting.com/Uploads/202201/PADserieMobilGasStation1.jpg')", backgroundSize: "cover", backgroundPosition: "center center", display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center"}} className="container-fluid vh-100 p-3">
                <div style={{backgroundColor: '#FFF', borderRadius: "20px", minHeight: "300px", width: "60%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center"}} className="score">
                    <h1 className='text-dark d-flex align-items-center justify-content-center'>Runs Scored: {score}</h1>
                </div>
            </section>
        </>
    )
}