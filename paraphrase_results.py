from pathlib import Path
from openpyxl import load_workbook

SRC = Path(__file__).parent / "evaluation_results_copy.xlsx"

PARAPHRASES = {
    3: "I arrived home near 6 in the evening and took some time to rest after such a full and productive day. It was well-deserved after everything I had done.",
    4: "Just a heads up — this Friday I have 8 class credits lined up from 7:30 in the morning until 4 in the afternoon. It's going to be a long day.",
    5: "All things considered, the day ended on a balanced and steady note. It felt like a rewarding finish to everything I worked through.",
    6: "Here's what I'm thinking: tonight I'll study for the eight final exams coming up, and once that's done I'll get ready for bed. That should keep me on track.",
    7: "I really appreciate how this app teaches us to stay patient and keep showing up. It helps build consistency in a simple way.",
    8: "It wasn't perfect progress, but that's okay. I'm still moving forward.",
    10: "Playing that game helped me let off some steam and finish the day feeling a bit lighter. It was a nice way to shake off the stress.",
    11: "Once I got home, I hopped in the shower and then took a little time to rest. It felt good to finally unwind.",
    12: "My friends from the mosque and I planned to grill chicken together, and because of that the night felt warm and lively. It was a great time even though I had woken up really early.",
    13: "I made my way home afterward and stopped along the way to grab a quick bite. I also got to meet up with someone special for a bit.",
    15: "The day was packed but still really enjoyable, and it felt productive from the moment I started until I finished. I made good use of my time.",
    16: "Looking back, the day was filled with learning, working as a team, and preparing for what's coming next. It was a solid and productive day overall.",
    18: "Even though the day left me pretty tired, working together as a team and putting in shared effort made everything feel worthwhile. It ended up being both productive and rewarding.",
    19: "Friday was a pretty hectic day. There was a lot going on.",
    20: "By the time the day wrapped up, I felt proud of myself. I had gotten through my presentation without any issues and picked up a lot of useful knowledge along the way.",
    21: "Even with a day full of classes, project deadlines, and errands, I still felt like I got a lot done and enjoyed hanging out with my friends. Managing to finish important tasks while having a good time made it all worth it.",
    22: "After that, I went to the electronics and digital class with a friend. Later in the evening, I took a break before heading back to Magelang City.",
    23: "I'm keeping my fingers crossed that the weather stays nice and that everything goes smoothly tomorrow. That would make things a lot easier.",
    24: "That's all for now. Take care!",
    25: "Honestly, I'm super exhausted after all that, so I'm crashing at my friend's place tonight and staying until tomorrow. I just don't have the energy to head back.",
    26: "To be honest, by that point I had already run out of social energy completely. I just needed some quiet time.",
    27: "After that, I took a short break in my room before making my way back home to Magelang. Just needed to recharge a bit first.",
    28: "Today was quite tiring, but I managed to get a lot done. I'm hoping the next round goes even smoother.",
    30: "I walked home with a huge grin on my face. It was just one of those days that leaves you feeling happy.",
    31: "Afterward, I sat down and rested for a little while, just thinking about what steps I should take next. It helped me clear my head.",
    32: "On my way back, I grabbed some fried chicken and tofu to eat before diving back into the rest of my Lingojourn assignments. I wanted to get them finished.",
    9: "It was a tiring day, but I got a lot done and learned a ton along the way. Completing all those responsibilities made it feel really worthwhile.",
    14: "I spent some time watching YouTube and then played games until 10 at night. After that, I prayed Isha, listened to some music, and finally went to sleep.",
    17: "The day felt long but I was really productive — it was packed with schoolwork, creative tasks, and working together with others. All of it felt pretty meaningful.",
    29: "Toward the end of the day, I took care of the trash and cleared out the clutter from earlier. Finishing that left me feeling light and accomplished as I moved into the evening.",
    33: "Late at night, I worked on Java programming from the web development class and kept at it until I started feeling drowsy. Eventually, I just headed to bed.",
    34: "A big family gathering was taking place there. It was a pretty significant event for everyone.",
    35: "I made it home around 9 at night, took a warm bath, and had dinner. Then I spent the rest of the evening unwinding and finishing up my Lingou journal for the very last time.",
    36: "I'm excited to wake up tomorrow and try to be a better version of myself. Every day is a chance to grow.",
    37: "There were still some mistakes in it, but I didn't give up and kept working through them. That's what matters.",
    38: "Later on, I just got into bed and fell asleep without any trouble. It was a solid end to the night.",
    39: "Even though I finish the day feeling worn out, it still manages to feel enjoyable and like I made good use of my time. I can't really complain.",
    40: "Yeah, it stings a little, but that's just how things are sometimes. Nothing I can do about it now.",
    41: "Once I finished, I was still pretty sleepy, so I got myself ready and crawled back into bed. That was pretty much it for the night.",
    42: "On the whole, the day was both productive and really enjoyable. I wouldn't mind having more days like this.",
}

wb = load_workbook(SRC)
ws = wb.active

updated = 0
for r in range(2, ws.max_row + 1):
    sid = ws.cell(row=r, column=2).value
    if sid and sid in PARAPHRASES:
        ws.cell(row=r, column=7).value = PARAPHRASES[sid]
        updated += 1

wb.save(SRC)
print(f"Done. Updated {updated} rows -> {SRC}")
