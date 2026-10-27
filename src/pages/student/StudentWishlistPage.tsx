import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCartWishlist } from '../../context/CartWishlistContext';
import { courseService } from '../../services/api';
import { Course } from '../../types';
import { CourseCard } from '../../components/common/CourseCard';
import { Heart, Compass } from 'lucide-react';

export const StudentWishlistPage: React.FC = () => {
  const { wishlist } = useCartWishlist();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    courseService.getAllCourses().then((all) => {
      setCourses(all.filter((c) => wishlist.includes(c.id)));
      setLoading(false);
    });
  }, [wishlist]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111827]">My Saved Wishlist</h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Masterclasses you have bookmarked for future enrollment.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[#64748B]">Loading wishlist...</div>
      ) : courses.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <Heart className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
          <h3 className="font-display text-sm font-bold text-[#111827]">Your wishlist is currently empty</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            Browse our catalog of expert courses and click the heart icon on any card to save it here.
          </p>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004AAD] rounded-lg"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Browse Catalog</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
};
