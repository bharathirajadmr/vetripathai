export interface Exam {
    id: string;
    name: string;
    category: string;
    syllabusFile?: string;
}

export const EXAMS: Exam[] = [
    {
        id: 'tnpsc-group-1',
        name: 'TNPSC Group 1',
        category: 'TNPSC',
        syllabusFile: 'tnpsc-group-1'
    },
    {
        id: 'tnpsc-group-2',
        name: 'TNPSC Group 2 & 2A',
        category: 'TNPSC',
        syllabusFile: 'tnpsc-group-2'
    },
    {
        id: 'tnpsc-group-4',
        name: 'TNPSC Group 4',
        category: 'TNPSC',
        syllabusFile: 'tnpsc-group-4'
    },
    {
        id: 'upsc-prelims',
        name: 'UPSC Civil Services (Prelims)',
        category: 'UPSC',
        syllabusFile: 'upsc-prelims'
    },
    {
        id: 'neet-ug',
        name: 'NEET UG',
        category: 'Medical',
        syllabusFile: 'neet-ug'
    }
];
