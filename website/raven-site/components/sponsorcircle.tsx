"use client";

import { Users, Github, Code2, Zap, Heart, Star } from "lucide-react";

const placeholderItems = [
  { icon: Github, color: "#94a3b8" },
  { icon: Code2, color: "#fbbf24" },
  { icon: Zap, color: "#67e8f9" },
  { icon: Star, color: "#f472b6" },
  { icon: Heart, color: "#fb923c" },
  { icon: Users, color: "#60a5fa" },
];
export function SponsorsCircle() {
  const items = 10; 
  const dots = 24; 

  return (
    <div className="py-16 px-4 bg-background">
      <div className="max-w-5xl mx-auto flex justify-center">
        
        <div className="relative w-[90vw] max-w-[620px] aspect-square">

       
          <div className="absolute inset-0 rounded-full border border-border/50" />

      
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[40%] aspect-square rounded-full border border-border/40 bg-card/60 flex items-center justify-center text-center p-4">
              <div>
                <div className="text-4xl md:text-6xl mb-2">🤝</div>
                <p className="text-sm md:text-base font-medium text-muted-foreground">
                  Be the first sponsor
                </p>
              </div>
            </div>
          </div>

          {Array.from({ length: items }).map((_, index) => {
            const angle = (index * 2 * Math.PI) / items;

            return (
              <div
                key={index}
                className="absolute w-[12%] aspect-square rounded-full border border-border bg-card shadow-sm transition hover:scale-110"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * 38}%)`,
                  top: `calc(50% + ${Math.sin(angle) * 38}%)`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}