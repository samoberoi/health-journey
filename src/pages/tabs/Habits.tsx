import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Award, Droplets, Flame, Dumbbell, Moon, Salad, Rocket, Footprints, Activity, ClipboardList, Sun, Sunrise, Check } from "lucide-react";

const habitCategories = [
  {
    id: "morning", label: "Morning Routine", icon: Sunrise,
    habits: [
      { id: "walk", icon: Footprints, label: "Morning Walk", xp: 20, streak: 7 },
      { id: "water", icon: Droplets, label: "Drink Water", xp: 10, streak: 14 },
      { id: "meditation", icon: Sun, label: "Meditate", xp: 15, streak: 3 },
    ],
  },
  {
    id: "nutrition", label: "Nutrition", icon: Salad,
    habits: [
      { id: "breakfast", icon: Salad, label: "Healthy Breakfast", xp: 20, streak: 5 },
      { id: "diabetes_log", icon: Activity, label: "Log Blood Glucose", xp: 25, streak: 14 },
      { id: "meal_plan", icon: ClipboardList, label: "Follow Meal Plan", xp: 30, streak: 2 },
    ],
  },
  {
    id: "fitness", label: "Fitness", icon: Dumbbell,
    habits: [
      { id: "workout", icon: Dumbbell, label: "Strength Training", xp: 40, streak: 4 },
      { id: "steps", icon: Footprints, label: "10k Steps", xp: 30, streak: 6 },
      { id: "stretch", icon: Activity, label: "Evening Stretch", xp: 15, streak: 0 },
    ],
  },
];

const badges = [
  { icon: Droplets, label: "Hydration Hero", earned: true, color: "text-primary" },
  { icon: Flame, label: "7-Day Streak", earned: true, color: "text-destructive" },
  { icon: Dumbbell, label: "First Workout", earned: true, color: "text-warning" },
  { icon: Moon, label: "Sleep Champion", earned: false, color: "text-muted-foreground" },
  { icon: Salad, label: "Meal Master", earned: false, color: "text-muted-foreground" },
  { icon: Rocket, label: "Transformer", earned: false, color: "text-muted-foreground" },
];

export default function Habits() {
  const [checked, setChecked] = useState<string[]>([]);
  const totalXP = checked.reduce((acc, id) => {
    for (const cat of habitCategories) {
      const h = cat.habits.find((h) => h.id === id);
      if (h) return acc + h.xp;
    }
    return acc;
  }, 0);

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="theme-move flex flex-col gap-5 px-5 pt-4 pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-foreground">Daily Habits</h1>
        <p className="text-muted-foreground text-sm">Build your transformation, one habit at a time</p>
      </motion.div>

      {/* XP card */}
      <motion.div
        className="liquid-glass rounded-3xl p-5 flex items-center justify-between"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <p className="text-muted-foreground text-xs mb-1">Today's XP</p>
          <p className="text-4xl font-black text-primary">{totalXP}</p>
          <p className="text-muted-foreground text-xs mt-1">/ 210 XP possible</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary" strokeWidth={1.6} />
          </div>
        </div>
      </motion.div>


      {/* Habit categories */}
      {habitCategories.map((cat, ci) => {
        const CatIcon = cat.icon;
        return (
          <motion.div
            key={cat.id}
            className="liquid-glass rounded-3xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + ci * 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CatIcon className="w-5 h-5 text-primary" strokeWidth={1.6} />
              <span className="text-foreground font-bold">{cat.label}</span>
            </div>
            <div className="flex flex-col gap-3">
              {cat.habits.map((habit, i) => {
                const done = checked.includes(habit.id);
                const HabitIcon = habit.icon;
                return (
                  <motion.button
                    key={habit.id}
                    onClick={() => toggle(habit.id)}
                    className="flex items-center gap-3 w-full"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + ci * 0.1 + i * 0.04 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        done ? "bg-primary/20" : "bg-muted"
                      }`}
                      animate={done ? { scale: [1, 1.25, 1] } : {}}
                    >
                      {done && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />}
                    </motion.div>
                    <HabitIcon className={`w-5 h-5 flex-shrink-0 ${done ? "text-muted-foreground" : "text-primary"}`} strokeWidth={1.6} />
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-medium transition-colors ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {habit.label}
                      </p>
                      {habit.streak > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Flame className="w-3 h-3 text-destructive" />
                          <p className="text-muted-foreground text-xs">{habit.streak} day streak</p>
                        </div>
                      )}
                    </div>
                    <span className="text-primary text-xs font-bold">+{habit.xp} XP</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        );
      })}

      {/* Badges */}
      <motion.div
        className="liquid-glass rounded-3xl p-5"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-warning" strokeWidth={1.6} />
          <span className="text-foreground font-bold">Your Badges</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((badge) => {
            const BadgeIcon = badge.icon;
            return (
              <div
                key={badge.label}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl ${
                  badge.earned ? "liquid-glass bg-warning/10" : "liquid-glass opacity-40"
                }`}
              >
                <BadgeIcon className={`w-6 h-6 ${badge.color}`} strokeWidth={1.6} />
                <span className="text-xs text-muted-foreground text-center font-medium leading-tight">{badge.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
