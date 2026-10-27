import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { instructorService, courseService } from '../../services/api';
import { Instructor, Course } from '../../types';
import { CourseCard } from '../../components/common/CourseCard';
import { Star, Users, BookOpen, Globe, Award } from 'lucide-react';

export const InstructorDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [authoredCourses, setAuthoredCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    instructorService.getInstructorById(id).then((inst) => {
      setInstructor(inst);
      if (inst) {
        courseService.getAllCourses().then((courses) => {
          setAuthoredCourses(courses.filter((c) => c.instructor.id === inst.id));
        });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-sm text-[#64748B]">Loading instructor profile...</div>;
  }

  if (!instructor) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Instructor Not Found</h2>
        <Link to="/instructors" className="text-xs text-[#004AAD] underline">
          Return to Instructor Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 sm:p-10 flex flex-col md:flex-row items-start gap-8">
        <img
          src={instructor.avatar}
          alt={instructor.name}
          referrerPolicy="no-referrer"
          className="w-28 h-28 rounded-2xl object-cover border-2 border-[#E2E8F0]"
        />

        <div className="space-y-3 flex-1">
          <div className="text-xs font-bold text-[#004AAD] uppercase tracking-wider">
            {instructor.company}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827]">
            {instructor.name}
          </h1>
          <p className="text-sm font-semibold text-[#64748B]">{instructor.title}</p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] pt-1">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span className="font-bold text-[#111827] tabular-nums">{instructor.rating} Instructor Rating</span>
            </div>
            <span>·</span>
            <span className="tabular-nums font-medium">{instructor.totalStudents.toLocaleString()} Students</span>
            <span>·</span>
            <span className="tabular-nums font-medium">{instructor.coursesCount} Courses</span>
          </div>

          <p className="text-xs sm:text-sm text-[#111827] leading-relaxed pt-2 max-w-3xl">
            {instructor.bio}
          </p>
        </div>
      </div>

      {/* Courses by this instructor */}
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111827] mb-6">
          Courses Taught by {instructor.name}
        </h2>
        {authoredCourses.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center text-xs text-[#64748B]">
            <BookOpen className="w-8 h-8 text-[#64748B] mx-auto opacity-40 mb-2" />
            <p className="font-semibold text-sm text-[#111827]">No courses authored yet</p>
            <p>Courses published by this instructor will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {authoredCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
