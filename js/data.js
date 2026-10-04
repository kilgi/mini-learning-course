const COURSE = {
  id: "intro-to-ai",
  title: "Intro to AI for Beginners",
  description: "Understand what artificial intelligence is, how it learns from examples, and how to use AI thoughtfully in everyday life.",
  lessons: [
    {
      id: "lesson-1",
      title: "What is AI?",
      summary: "Learn what people mean by artificial intelligence and where it appears in everyday tools.",
      sections: [
        {
        heading: "A useful definition",
          paragraphs: [
            "Artificial intelligence (AI) is a broad name for computer systems that perform tasks we associate with human abilities, such as recognizing patterns, understanding language, or making predictions.",
            "AI is not one single machine or technique. A spam filter, a voice transcription tool, and a program that recommends a film can all use different AI methods to solve different problems."
          ]
        },
        {
          heading: "AI in everyday life",
          paragraphs: ["You may already encounter AI when a map estimates travel time, a photo app groups similar faces, or an email service filters unwanted messages."],
          points: [
            "AI systems are designed for particular tasks; skill at one task does not mean general understanding.",
            "The output is a result produced by a system, not automatically a fact or a human judgment."
          ]
        }
      ]
    },
    {
      id: "lesson-2",
      title: "How does AI learn?",
      summary: "See how examples help a model find patterns, and why the quality of those examples matters.",
      sections: [
        {
          heading: "Learning from examples",
          paragraphs: [
            "Many modern AI systems are built using machine learning. Instead of writing a separate rule for every situation, developers provide examples and a learning algorithm adjusts a model to find patterns in them.",
            "For example, a model trained to recognize bicycles can study many labeled pictures. During training, it adjusts its internal settings so its predictions better match the examples."
          ]
        },
        {
          heading: "Practice is not understanding",
          paragraphs: ["A model can perform well on familiar examples and still make mistakes on new ones. Its results depend on the data and task it was trained for."],
          points: [
            "Incomplete or unbalanced examples can lead to unreliable results.",
            "Testing on examples the model has not seen helps reveal how well it generalizes.",
            "People choose the goal, prepare data, evaluate results, and decide how a system should be used."
          ]
        }
      ]
    },
    {
      id: "lesson-3",
      title: "Using AI well",
      summary: "Build practical habits for checking AI output, protecting private information, and keeping people responsible for decisions.",
      sections: [
        {
          heading: "Treat output as a draft",
          paragraphs: [
            "AI tools can help brainstorm, summarize, or organize information. They can also produce confident-sounding errors, leave out context, or reflect patterns in their training data.",
            "For important questions, check claims against reliable sources and use your own judgment before acting on a suggestion."
          ]
        },
        {
          heading: "A few good habits",
          paragraphs: ["A thoughtful workflow keeps people involved, especially when an answer could affect someone's safety, money, rights, or opportunities."],
          points: [
            "Do not enter sensitive personal or confidential information unless the tool is approved for it.",
            "Check important facts, dates, calculations, and citations independently.",
            "Be transparent when AI has meaningfully contributed to work that others will rely on."
          ]
        }
      ]
    }
  ]
};

const COURSES = [COURSE];