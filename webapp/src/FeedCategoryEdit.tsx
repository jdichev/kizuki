import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";
import SettingsSubNavigation from "./components/SettingsSubNavigation";

const ds = DataService.getInstance();

export default function FeedCategoryEdit() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const isNew = !categoryId;
  const isUncategorized = !isNew && Number(categoryId) === 0;
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm();

  const [formFeedCategoryData, setFormFeedCategoryData] =
    useState<FeedCategory>();

  useEffect(() => {
    const loadFormFeedCategoryData = async () => {
      if (isNew) {
        setFormFeedCategoryData({ title: "", text: "", autoSummarize: null });
      } else {
        const categoryIdNum = parseInt(categoryId || "0", 10);
        const feedCategories = await ds.getFeedCategories();
        const feedCategory = feedCategories.find(
          (category) => category.id === categoryIdNum
        );

        if (feedCategory) {
          setFormFeedCategoryData(feedCategory);
          setValue("title", feedCategory.title);
          setValue("text", feedCategory.text);
          setValue("autoSummarize", Boolean(feedCategory.autoSummarize));
        }
      }
    };

    loadFormFeedCategoryData();
  }, [categoryId, isNew, setValue]);

  const onSubmit = useCallback(
    async (data: FieldValues) => {
      const existingTitle = formFeedCategoryData?.title || "";
      const existingText = formFeedCategoryData?.text || "";
      const resolvedAutoSummarize = dirtyFields.autoSummarize
        ? data.autoSummarize
          ? 1
          : 0
        : (formFeedCategoryData?.autoSummarize ?? null);

      const feedCategory: FeedCategory = {
        id: isNew ? undefined : parseInt(categoryId || "0", 10),
        title: isUncategorized ? existingTitle : data.title,
        text: isUncategorized ? existingText : data.text,
        autoSummarize: resolvedAutoSummarize,
      };

      if (isNew) {
        await ds.addFeedCategory(feedCategory);
      } else {
        await ds.updateFeedCategory(feedCategory);
      }

      navigate("/feed-categories/list");
    },
    [
      navigate,
      categoryId,
      isNew,
      isUncategorized,
      formFeedCategoryData,
      dirtyFields.autoSummarize,
    ]
  );

  return (
    <>
      <SettingsSubNavigation activeSection="feed-categories" />

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h3>
                {isNew ? "New " : "Edit "}
                Category{" "}
                {formFeedCategoryData?.title
                  ? `- ${formFeedCategoryData.title}`
                  : ""}
              </h3>
              {isUncategorized && (
                <p className="text-muted">
                  For Uncategorized, only automatic summarization can be edited.
                </p>
              )}
              <div>
                <label htmlFor="title" className="form-label">
                  Category Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  maxLength={256}
                  required={!isUncategorized}
                  disabled={isUncategorized}
                  {...register("title")}
                />
                {errors.title && <p>Title is required</p>}
              </div>
              <div>
                <label htmlFor="text" className="form-label">
                  Description
                </label>
                <textarea
                  className="form-control"
                  id="text"
                  rows={4}
                  disabled={isUncategorized}
                  {...register("text")}
                />
              </div>
              <div className="form-check mt-3 mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="autoSummarize"
                  {...register("autoSummarize")}
                />
                <label className="form-check-label" htmlFor="autoSummarize">
                  Enable automatic summarization for this category
                </label>
              </div>

              <button type="submit" className="btn btn-primary">
                Save
              </button>

              <Link
                to="/feed-categories/list"
                className="btn btn-outline-secondary"
              >
                Back
              </Link>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
